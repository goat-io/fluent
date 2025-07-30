#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { MySqlContainer } from '@testcontainers/mysql'
import chalk from 'chalk'
import { and, eq, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/drizzle-schema'

// Kysely database interface
interface Database {
  users: {
    id: number
    email: string
    first_name: string
    last_name: string
    created_at: Date
    updated_at: Date
    status: 'active' | 'inactive' | 'suspended'
    age: number | null
    country: string | null
  }
  products: {
    id: number
    name: string
    description: string | null
    price: number
    category_id: number | null
    stock_quantity: number
    created_at: Date
    updated_at: Date
    is_active: boolean
  }
  categories: {
    id: number
    name: string
    parent_id: number | null
    description: string | null
  }
  orders: {
    id: number
    user_id: number
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    total_amount: number
    created_at: Date
    updated_at: Date
    shipping_address: string | null
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🔍 Database Query Verification Test\n'))

  // Start MySQL container
  console.log(chalk.yellow('Starting MySQL container...'))
  const mysqlContainer = await new MySqlContainer('mysql:8.0')
    .withDatabase('benchmark_db')
    .withUsername('benchmark_user')
    .withUserPassword('benchmark_pass')
    .withRootPassword('root_pass')
    .withExposedPorts(3306)
    .start()

  const host = mysqlContainer.getHost()
  const port = mysqlContainer.getMappedPort(3306)

  // Setup connections
  const mysql2Connection = await mysql.createConnection({
    host,
    port,
    user: 'benchmark_user',
    password: 'benchmark_pass',
    database: 'benchmark_db'
  })

  const prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: `mysql://benchmark_user:benchmark_pass@${host}:${port}/benchmark_db`
      }
    },
    log: ['query']
  })

  const pool = createPool({
    host,
    port,
    user: 'benchmark_user',
    password: 'benchmark_pass',
    database: 'benchmark_db'
  })

  const kyselyDb = new Kysely<Database>({
    dialect: new MysqlDialect({ pool })
  })

  const drizzleDb = drizzle(pool, { schema, mode: 'default' })

  // Setup schema
  console.log(chalk.yellow('Setting up database schema...'))
  await mysql2Connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
      age INT,
      country VARCHAR(100),
      INDEX idx_status (status),
      INDEX idx_age (age)
    )
  `)

  // Add test data
  console.log(chalk.yellow('Adding test data...'))
  const users = []
  for (let i = 1; i <= 100; i++) {
    users.push([
      `user${i}@example.com`,
      `FirstName${i}`,
      `LastName${i}`,
      i % 3 === 0 ? 'active' : i % 3 === 1 ? 'inactive' : 'suspended',
      Math.floor(Math.random() * 50) + 20,
      'US'
    ])
  }

  const placeholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
  await mysql2Connection.execute(
    `INSERT INTO users (email, first_name, last_name, status, age, country) VALUES ${placeholders}`,
    users.flat()
  )

  console.log(chalk.green('✅ Setup complete\n'))

  // Test 1: Simple SELECT with LIMIT
  console.log(chalk.cyan.bold('Test 1: Simple SELECT with LIMIT 50'))
  console.log(chalk.grey('Expected: Each DB should return 50 users\n'))

  // MySQL2
  const [mysql2Simple] = await mysql2Connection.execute(
    'SELECT * FROM users LIMIT 50'
  )
  console.log(`MySQL2: Retrieved ${(mysql2Simple as any[]).length} records`)

  // Prisma
  const prismaSimple = await prismaClient.user.findMany({ take: 50 })
  console.log(`Prisma: Retrieved ${prismaSimple.length} records`)

  // Kysely
  const kyselySimple = await kyselyDb
    .selectFrom('users')
    .selectAll()
    .limit(50)
    .execute()
  console.log(`Kysely: Retrieved ${kyselySimple.length} records`)

  // Drizzle
  const drizzleSimple = await drizzleDb.select().from(schema.users).limit(50)
  console.log(`Drizzle: Retrieved ${drizzleSimple.length} records`)

  // Test 2: Filtered SELECT
  console.log(
    chalk.cyan.bold(
      '\nTest 2: Filtered SELECT (status = "active" AND age > 25)'
    )
  )

  // Count expected results
  const [expectedCount] = await mysql2Connection.execute(
    'SELECT COUNT(*) as count FROM users WHERE status = ? AND age > ?',
    ['active', 25]
  )
  console.log(
    chalk.grey(`Expected: ${(expectedCount as any)[0].count} records\n`)
  )

  // MySQL2
  const [mysql2Filtered] = await mysql2Connection.execute(
    'SELECT * FROM users WHERE status = ? AND age > ?',
    ['active', 25]
  )
  console.log(`MySQL2: Retrieved ${(mysql2Filtered as any[]).length} records`)

  // Prisma
  const prismaFiltered = await prismaClient.user.findMany({
    where: { status: 'active', age: { gt: 25 } }
  })
  console.log(`Prisma: Retrieved ${prismaFiltered.length} records`)

  // Kysely
  const kyselyFiltered = await kyselyDb
    .selectFrom('users')
    .selectAll()
    .where('status', '=', 'active')
    .where('age', '>', 25)
    .execute()
  console.log(`Kysely: Retrieved ${kyselyFiltered.length} records`)

  // Drizzle
  const drizzleFiltered = await drizzleDb
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.status, 'active'), gt(schema.users.age, 25)))
  console.log(`Drizzle: Retrieved ${drizzleFiltered.length} records`)

  // Test 3: Performance measurement verification
  console.log(
    chalk.cyan.bold('\nTest 3: Performance Measurement (10 iterations each)')
  )

  const iterations = 10
  const drivers = ['MySQL2', 'Prisma', 'Kysely', 'Drizzle']
  const times: Record<string, number[]> = {
    MySQL2: [],
    Prisma: [],
    Kysely: [],
    Drizzle: []
  }

  for (let i = 0; i < iterations; i++) {
    // MySQL2
    const mysql2Start = Date.now()
    await mysql2Connection.execute('SELECT * FROM users LIMIT 50')
    times.MySQL2.push(Date.now() - mysql2Start)

    // Prisma
    const prismaStart = Date.now()
    await prismaClient.user.findMany({ take: 50 })
    times.Prisma.push(Date.now() - prismaStart)

    // Kysely
    const kyselyStart = Date.now()
    await kyselyDb.selectFrom('users').selectAll().limit(50).execute()
    times.Kysely.push(Date.now() - kyselyStart)

    // Drizzle
    const drizzleStart = Date.now()
    await drizzleDb.select().from(schema.users).limit(50)
    times.Drizzle.push(Date.now() - drizzleStart)
  }

  console.log('\nAverage times (ms):')
  for (const driver of drivers) {
    const avg = times[driver].reduce((a, b) => a + b, 0) / iterations
    const min = Math.min(...times[driver])
    const max = Math.max(...times[driver])
    console.log(
      `${driver.padEnd(8)}: avg=${avg.toFixed(2)}ms, min=${min}ms, max=${max}ms`
    )
  }

  // Cleanup
  console.log(chalk.yellow('\nCleaning up...'))
  await mysql2Connection.end()
  await prismaClient.$disconnect()
  await kyselyDb.destroy()
  await pool.end()
  await mysqlContainer.stop()

  console.log(chalk.green('✅ Verification complete\n'))
}

main().catch(console.error)

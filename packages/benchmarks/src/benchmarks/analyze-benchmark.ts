#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { MySqlContainer } from '@testcontainers/mysql'
import chalk from 'chalk'
import { drizzle } from 'drizzle-orm/mysql2'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import mysql from 'mysql2/promise'
import { createBenchmarkRunner } from '../core/BenchmarkRunner'
import * as schema from '../database/drizzle-schema'

// Same DB interface as main benchmark
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
}

async function main() {
  console.log(chalk.bold.blue('\n📊 Benchmark Analysis and Verification\n'))

  const runner = createBenchmarkRunner()

  // Start container
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

  process.env.DATABASE_URL = `mysql://benchmark_user:benchmark_pass@${host}:${port}/benchmark_db`

  const prismaClient = new PrismaClient({
    log: ['error']
  })

  const pool = createPool({
    host,
    port,
    user: 'benchmark_user',
    password: 'benchmark_pass',
    database: 'benchmark_db',
    connectionLimit: 10
  })

  const kyselyDb = new Kysely<Database>({
    dialect: new MysqlDialect({ pool })
  })

  const drizzleDb = drizzle(pool, { schema, mode: 'default' })

  // Setup schema
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

  // Add 1000 users like main benchmark
  const users = []
  for (let i = 1; i <= 1000; i++) {
    users.push([
      `user${i}@example.com`,
      `FirstName${i}`,
      `LastName${i}`,
      'active',
      Math.floor(Math.random() * 50) + 20,
      'US'
    ])
  }

  const placeholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
  await mysql2Connection.execute(
    `INSERT IGNORE INTO users (email, first_name, last_name, status, age, country) VALUES ${placeholders}`,
    users.flat()
  )

  console.log(chalk.green('✅ Setup complete with 1000 users\n'))

  // Test 1: Verify query equivalence
  console.log(chalk.cyan.bold('Test 1: Query Equivalence Check'))

  // Simple SELECT
  console.log('\nSimple SELECT (LIMIT 50):')
  const queryCount = { mysql2: 0, prisma: 0, kysely: 0, drizzle: 0 }

  const scenarios = [
    {
      name: 'Simple SELECT',
      iterations: 10,
      mysql2: async () => {
        queryCount.mysql2++
        await mysql2Connection.execute('SELECT * FROM users LIMIT 50')
      },
      prisma: async () => {
        queryCount.prisma++
        await prismaClient.user.findMany({ take: 50 })
      },
      kysely: async () => {
        queryCount.kysely++
        await kyselyDb.selectFrom('users').selectAll().limit(50).execute()
      },
      drizzle: async () => {
        queryCount.drizzle++
        await drizzleDb.select().from(schema.users).limit(50)
      }
    }
  ]

  // Run each driver
  for (const scenario of scenarios) {
    console.log(
      `\nRunning ${scenario.iterations} iterations for each driver...`
    )

    // Run benchmarks
    const mysql2Result = await runner.run(scenario.mysql2, {
      name: 'MySQL2',
      iterations: scenario.iterations,
      warmupRuns: 2
    })

    const prismaResult = await runner.run(scenario.prisma, {
      name: 'Prisma',
      iterations: scenario.iterations,
      warmupRuns: 2
    })

    const kyselyResult = await runner.run(scenario.kysely, {
      name: 'Kysely',
      iterations: scenario.iterations,
      warmupRuns: 2
    })

    const drizzleResult = await runner.run(scenario.drizzle, {
      name: 'Drizzle',
      iterations: scenario.iterations,
      warmupRuns: 2
    })

    console.log('\nQuery counts (including warmup):')
    console.log(`MySQL2:  ${queryCount.mysql2} queries`)
    console.log(`Prisma:  ${queryCount.prisma} queries`)
    console.log(`Kysely:  ${queryCount.kysely} queries`)
    console.log(`Drizzle: ${queryCount.drizzle} queries`)

    console.log('\nPerformance results:')
    console.log(
      `MySQL2:  ${mysql2Result.operationsPerSecond.toFixed(0)} ops/sec, ${mysql2Result.averageTime.toFixed(2)}ms avg`
    )
    console.log(
      `Prisma:  ${prismaResult.operationsPerSecond.toFixed(0)} ops/sec, ${prismaResult.averageTime.toFixed(2)}ms avg`
    )
    console.log(
      `Kysely:  ${kyselyResult.operationsPerSecond.toFixed(0)} ops/sec, ${kyselyResult.averageTime.toFixed(2)}ms avg`
    )
    console.log(
      `Drizzle: ${drizzleResult.operationsPerSecond.toFixed(0)} ops/sec, ${drizzleResult.averageTime.toFixed(2)}ms avg`
    )
  }

  // Test 2: Check for caching effects
  console.log(chalk.cyan.bold('\n\nTest 2: Caching Effects'))

  console.log('\nRunning 50 sequential queries per driver...')
  const times: Record<string, number[]> = {
    mysql2: [],
    prisma: [],
    kysely: [],
    drizzle: []
  }

  // MySQL2
  for (let i = 0; i < 50; i++) {
    const start = Date.now()
    await mysql2Connection.execute('SELECT * FROM users LIMIT 50')
    times.mysql2.push(Date.now() - start)
  }

  // Prisma
  for (let i = 0; i < 50; i++) {
    const start = Date.now()
    await prismaClient.user.findMany({ take: 50 })
    times.prisma.push(Date.now() - start)
  }

  // Kysely
  for (let i = 0; i < 50; i++) {
    const start = Date.now()
    await kyselyDb.selectFrom('users').selectAll().limit(50).execute()
    times.kysely.push(Date.now() - start)
  }

  // Drizzle
  for (let i = 0; i < 50; i++) {
    const start = Date.now()
    await drizzleDb.select().from(schema.users).limit(50)
    times.drizzle.push(Date.now() - start)
  }

  // Analyze timing patterns
  console.log('\nTiming analysis:')
  for (const [driver, driverTimes] of Object.entries(times)) {
    const first10Avg = driverTimes.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    const last10Avg = driverTimes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const improvement = (((first10Avg - last10Avg) / first10Avg) * 100).toFixed(
      1
    )

    console.log(
      `${driver.padEnd(8)}: First 10 avg=${first10Avg.toFixed(2)}ms, Last 10 avg=${last10Avg.toFixed(2)}ms, Improvement=${improvement}%`
    )
  }

  // Test 3: Connection pooling effects
  console.log(chalk.cyan.bold('\n\nTest 3: Connection Pooling Analysis'))

  // Check if drivers use different connection strategies
  console.log('\nConnection strategy:')
  console.log('MySQL2:  Single connection')
  console.log('Prisma:  Connection pool (default 10)')
  console.log('Kysely:  Connection pool (configured 10)')
  console.log('Drizzle: Connection pool (configured 10)')

  // Cleanup
  await mysql2Connection.end()
  await prismaClient.$disconnect()
  await kyselyDb.destroy()
  await pool.end()
  await mysqlContainer.stop()

  console.log(chalk.green('\n✅ Analysis complete\n'))
}

main().catch(console.error)

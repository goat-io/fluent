#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { MikroORM } from '@mikro-orm/core'
import { MySqlDriver } from '@mikro-orm/mysql'
import { PrismaClient } from '@prisma/client'
import chalk from 'chalk'
import { and, sql as drizzleSql, eq, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import knex from 'knex'
import { Kysely, MysqlDialect } from 'kysely'
import * as mysql from 'mysql2'
import { createPool } from 'mysql2'
import * as mysqlPromise from 'mysql2/promise'
import { Sequelize } from 'sequelize'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { DataSource } from 'typeorm'
import * as schema from '../database/drizzle-schema'
import 'reflect-metadata'
import { OLTP_WORKLOAD } from './transaction-types'

interface Database {
  users: any
  products: any
  categories: any
  orders: any
  order_items: any
  reviews: any
}

interface TestResult {
  driver: string
  operations: number
  opsPerSecond: number
  avgLatency: number
  p95Latency: number
  errors: number
  transactionBreakdown: Record<string, number>
}

export class EnhancedAllDriversBenchmark {
  private mysqlContainer!: StartedTestContainer
  private connections: Map<string, any> = new Map()

  private readonly TEST_DURATION: number
  private readonly THINK_TIME = process.env.THINK_TIME === 'true'

  constructor() {
    // Parse time parameter from command line arguments
    const args = process.argv.slice(2)
    const timeArg = args.find(arg => arg.startsWith('--time='))
    const helpArg = args.find(arg => arg === '--help' || arg === '-h')

    if (helpArg) {
      console.log(chalk.blue('🚀 Enhanced Database Benchmark - All Drivers\n'))
      console.log(chalk.white('Usage: pnpm benchmark [options]\n'))
      console.log(chalk.white('Options:'))
      console.log(
        chalk.gray(
          '  --time=<seconds>  Set test duration per driver (default: 10)'
        )
      )
      console.log(chalk.gray('  --help, -h        Show this help message\n'))
      console.log(chalk.white('Examples:'))
      console.log(
        chalk.gray(
          '  pnpm benchmark                    # Run with default 10 seconds'
        )
      )
      console.log(
        chalk.gray(
          '  pnpm benchmark -- --time=5        # Run for 5 seconds per driver'
        )
      )
      console.log(
        chalk.gray(
          '  pnpm benchmark -- --time=30       # Run for 30 seconds per driver'
        )
      )
      process.exit(0)
    }

    if (timeArg) {
      const timeValue = Number.parseInt(timeArg.split('=')[1], 10)
      if (Number.isNaN(timeValue) || timeValue <= 0) {
        console.error(
          chalk.red('Invalid time value. Using default of 10 seconds.')
        )
        this.TEST_DURATION = 10000
      } else {
        this.TEST_DURATION = timeValue * 1000 // Convert to milliseconds
      }
    } else {
      this.TEST_DURATION = 10000 // Default 10 seconds
    }
  }

  async run(): Promise<void> {
    console.log(
      chalk.bold.blue('🚀 Enhanced Database Benchmark - All 10 Drivers')
    )
    console.log(
      chalk.gray(
        `Testing transaction mix patterns (${
          this.THINK_TIME ? 'with' : 'without'
        } think time)`
      )
    )
    console.log(
      chalk.gray(`Test duration: ${this.TEST_DURATION / 1000}s per driver\n`)
    )

    try {
      await this.setupEnvironment()

      // All 10 drivers
      const drivers = [
        'MySQL2',
        'MySQL2/Promise',
        'Knex',
        'Prisma',
        'Kysely',
        'Drizzle',
        'Prisma+Kysely',
        'TypeORM',
        'Sequelize',
        'MikroORM'
      ]

      const results: TestResult[] = []

      for (const driver of drivers) {
        process.stdout.write(chalk.yellow(`Testing ${driver}... `))

        try {
          const connection = await this.getConnection(driver)
          const result = await this.testDriver(driver, connection)
          results.push(result)

          if (result.errors > 0) {
            console.log(
              chalk.yellow(
                `✓ ${result.operations} ops @ ${result.opsPerSecond} ops/sec (${result.errors} errors)`
              )
            )
          } else {
            console.log(
              chalk.green(
                `✓ ${result.operations} ops @ ${result.opsPerSecond} ops/sec`
              )
            )
          }
        } catch (error) {
          console.log(chalk.red(`✗ Setup failed: ${error.message}`))
          results.push({
            driver,
            operations: 0,
            opsPerSecond: 0,
            avgLatency: 0,
            p95Latency: 0,
            errors: 1,
            transactionBreakdown: {}
          })
        }
      }

      this.showResults(results)
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error)
    } finally {
      await this.cleanup()
    }
  }

  private async testDriver(
    driver: string,
    connection: any
  ): Promise<TestResult> {
    const transactions = this.getTransactionExecutors(driver, connection)
    const transactionCounts: Record<string, number> = {
      simpleSelect: 0,
      filteredSelect: 0,
      joinQuery: 0,
      complexJoin: 0,
      insert: 0
    }

    const latencies: number[] = []
    let totalOps = 0
    let errors = 0

    // Quick warmup (reduce warmup time)
    for (let i = 0; i < 10; i++) {
      const tx = this.selectTransaction()
      try {
        await transactions[tx.name]()
      } catch (_error) {
        // Ignore warmup errors
      }
    }

    // Test phase
    const startTime = performance.now()
    const endTime = startTime + this.TEST_DURATION

    while (performance.now() < endTime) {
      const tx = this.selectTransaction()

      // Apply think time if enabled (but keep it short)
      if (this.THINK_TIME) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.random() * 50 + 25)
        )
      }

      const opStart = performance.now()
      try {
        await transactions[tx.name]()
        const opEnd = performance.now()

        latencies.push(opEnd - opStart)
        transactionCounts[tx.name]++
        totalOps++
      } catch (_error) {
        errors++
      }

      // Apply thinking time if enabled (but keep it short)
      if (this.THINK_TIME) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.random() * 100 + 50)
        )
      }
    }

    const duration = (performance.now() - startTime) / 1000 // Convert to seconds
    const sortedLatencies = latencies.sort((a, b) => a - b)

    return {
      driver,
      operations: totalOps,
      opsPerSecond: Math.round(totalOps / duration),
      avgLatency:
        latencies.length > 0
          ? Math.round(
              (latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100
            ) / 100
          : 0,
      p95Latency:
        latencies.length > 0
          ? Math.round(
              sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] * 100
            ) / 100
          : 0,
      errors,
      transactionBreakdown: transactionCounts
    }
  }

  private selectTransaction() {
    const transactions = OLTP_WORKLOAD.transactions
    const totalWeight = transactions.reduce((sum, t) => sum + t.weight, 0)
    let random = Math.random() * totalWeight

    for (const tx of transactions) {
      random -= tx.weight
      if (random <= 0) {
        return tx
      }
    }

    return transactions[0]
  }

  private getTransactionExecutors(
    driver: string,
    connection: any
  ): Record<string, () => Promise<void>> {
    const userId = () => Math.floor(Math.random() * 1000) + 1
    const age = () => 20 + Math.floor(Math.random() * 40)

    switch (driver) {
      case 'MySQL2':
        return {
          simpleSelect: () =>
            connection
              .promise()
              .execute('SELECT * FROM users WHERE id = ?', [userId()]),
          filteredSelect: () =>
            connection
              .promise()
              .execute(
                'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
                ['active', age()]
              ),
          joinQuery: () =>
            connection
              .promise()
              .execute(
                'SELECT u.*, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = ? GROUP BY u.id LIMIT 30',
                ['active']
              ),
          complexJoin: () =>
            connection
              .promise()
              .execute(
                'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = ? LIMIT 25',
                [true]
              ),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection
              .promise()
              .execute(
                'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
                [`test_${id}@example.com`, 'Test', 'User', 'active', 30, 'US']
              )
          }
        }

      case 'MySQL2/Promise':
        return {
          simpleSelect: () =>
            connection.execute('SELECT * FROM users WHERE id = ?', [userId()]),
          filteredSelect: () =>
            connection.execute(
              'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
              ['active', age()]
            ),
          joinQuery: () =>
            connection.execute(
              'SELECT u.*, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = ? GROUP BY u.id LIMIT 30',
              ['active']
            ),
          complexJoin: () =>
            connection.execute(
              'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = ? LIMIT 25',
              [true]
            ),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.execute(
              'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
              [`test_${id}@example.com`, 'Test', 'User', 'active', 30, 'US']
            )
          }
        }

      case 'Knex':
        return {
          simpleSelect: () => connection('users').where('id', userId()).first(),
          filteredSelect: () =>
            connection('users')
              .where('status', 'active')
              .where('age', '>', age())
              .limit(50),
          joinQuery: () =>
            connection('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select('u.*')
              .select(connection.raw('COUNT(o.id) as order_count'))
              .where('u.status', 'active')
              .groupBy('u.id')
              .limit(30),
          complexJoin: () =>
            connection('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .select('p.*')
              .select('c.name as category_name')
              .where('p.is_active', true)
              .limit(25),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection('users').insert({
              email: `test_${id}@example.com`,
              first_name: 'Test',
              last_name: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
          }
        }

      case 'Prisma':
        return {
          simpleSelect: () =>
            connection.user.findUnique({ where: { id: userId() } }),
          filteredSelect: () =>
            connection.user.findMany({
              where: { status: 'active', age: { gt: age() } },
              take: 50
            }),
          joinQuery: () =>
            connection.user.findMany({
              where: { status: 'active' },
              include: { orders: { select: { id: true } } },
              take: 30
            }),
          complexJoin: () =>
            connection.product.findMany({
              where: { isActive: true },
              include: { category: { select: { name: true } } },
              take: 25
            }),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.user.create({
              data: {
                email: `test_${id}@example.com`,
                firstName: 'Test',
                lastName: 'User',
                status: 'active',
                age: 30,
                country: 'US'
              }
            })
          }
        }

      case 'Kysely':
        return {
          simpleSelect: () =>
            connection
              .selectFrom('users')
              .where('id', '=', userId())
              .selectAll()
              .executeTakeFirst(),
          filteredSelect: () =>
            connection
              .selectFrom('users')
              .where('status', '=', 'active')
              .where('age', '>', age())
              .selectAll()
              .limit(50)
              .execute(),
          joinQuery: () =>
            connection
              .selectFrom('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select(['u.id', 'u.email'])
              .select(connection.fn.count('o.id').as('order_count'))
              .where('u.status', '=', 'active')
              .groupBy('u.id')
              .limit(30)
              .execute(),
          complexJoin: () =>
            connection
              .selectFrom('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .select(['p.id', 'p.name'])
              .select('c.name as category_name')
              .where('p.is_active', '=', true)
              .limit(25)
              .execute(),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection
              .insertInto('users')
              .values({
                email: `test_${id}@example.com`,
                first_name: 'Test',
                last_name: 'User',
                status: 'active',
                age: 30,
                country: 'US'
              })
              .execute()
          }
        }

      case 'Drizzle':
        return {
          simpleSelect: () =>
            connection
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, userId())),
          filteredSelect: () =>
            connection
              .select()
              .from(schema.users)
              .where(
                and(
                  eq(schema.users.status, 'active'),
                  gt(schema.users.age, age())
                )
              )
              .limit(50),
          joinQuery: () =>
            connection
              .select({
                id: schema.users.id,
                email: schema.users.email,
                orderCount: drizzleSql<number>`count(${schema.orders.id})`
              })
              .from(schema.users)
              .leftJoin(
                schema.orders,
                eq(schema.users.id, schema.orders.userId)
              )
              .where(eq(schema.users.status, 'active'))
              .groupBy(schema.users.id)
              .limit(30),
          complexJoin: () =>
            connection
              .select({
                id: schema.products.id,
                name: schema.products.name,
                categoryName: schema.categories.name
              })
              .from(schema.products)
              .leftJoin(
                schema.categories,
                eq(schema.products.categoryId, schema.categories.id)
              )
              .where(eq(schema.products.isActive, true))
              .limit(25),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.insert(schema.users).values({
              email: `test_${id}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
          }
        }

      case 'Prisma+Kysely':
        return {
          simpleSelect: () =>
            connection.$kysely
              .selectFrom('users')
              .where('id', '=', userId())
              .selectAll()
              .executeTakeFirst(),
          filteredSelect: () =>
            connection.$kysely
              .selectFrom('users')
              .where('status', '=', 'active')
              .where('age', '>', age())
              .selectAll()
              .limit(50)
              .execute(),
          joinQuery: () =>
            connection.$kysely
              .selectFrom('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select(['u.id', 'u.email'])
              .select(connection.$kysely.fn.count('o.id').as('order_count'))
              .where('u.status', '=', 'active')
              .groupBy('u.id')
              .limit(30)
              .execute(),
          complexJoin: () =>
            connection.$kysely
              .selectFrom('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .select(['p.id', 'p.name'])
              .select('c.name as category_name')
              .where('p.is_active', '=', true)
              .limit(25)
              .execute(),
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.$kysely
              .insertInto('users')
              .values({
                email: `test_${id}@example.com`,
                first_name: 'Test',
                last_name: 'User',
                status: 'active',
                age: 30,
                country: 'US'
              })
              .execute()
          }
        }

      case 'TypeORM':
        return {
          simpleSelect: async () => {
            const { User } = await import('../database/typeorm-entities')
            await connection
              .getRepository(User)
              .findOne({ where: { id: userId() } })
          },
          filteredSelect: async () => {
            const { User } = await import('../database/typeorm-entities')
            await connection
              .getRepository(User)
              .find({ where: { status: 'active' }, take: 50 })
          },
          joinQuery: async () => {
            const { User } = await import('../database/typeorm-entities')
            await connection.getRepository(User).find({
              where: { status: 'active' },
              relations: ['orders'],
              take: 30
            })
          },
          complexJoin: async () => {
            const { Product } = await import('../database/typeorm-entities')
            await connection.getRepository(Product).find({
              where: { isActive: true },
              relations: ['category'],
              take: 25
            })
          },
          insert: async () => {
            const { User } = await import('../database/typeorm-entities')
            const id = `${++this.insertCounter}_${Date.now()}`
            const user = connection.getRepository(User).create({
              email: `test_${id}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
            await connection.getRepository(User).save(user)
          }
        }

      case 'Sequelize':
        return {
          simpleSelect: async () => {
            const { User } = await import('../database/sequelize-models')
            await User.findByPk(userId())
          },
          filteredSelect: async () => {
            const { User } = await import('../database/sequelize-models')
            await User.findAll({ where: { status: 'active' }, limit: 50 })
          },
          joinQuery: async () => {
            await connection.query(
              'SELECT u.*, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = ? GROUP BY u.id LIMIT 30',
              { replacements: ['active'], type: connection.QueryTypes.SELECT }
            )
          },
          complexJoin: async () => {
            await connection.query(
              'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = ? LIMIT 25',
              { replacements: [true], type: connection.QueryTypes.SELECT }
            )
          },
          insert: async () => {
            const { User } = await import('../database/sequelize-models')
            const id = `${++this.insertCounter}_${Date.now()}`
            await User.create({
              email: `test_${id}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
          }
        }

      case 'MikroORM':
        return {
          simpleSelect: async () => {
            const { User } = await import(
              '../database/mikro-orm-entities-fixed'
            )
            const em = connection.em.fork()
            await em.findOne(User, { id: userId() })
          },
          filteredSelect: async () => {
            const { User } = await import(
              '../database/mikro-orm-entities-fixed'
            )
            const em = connection.em.fork()
            await em.find(User, { status: 'active' }, { limit: 50 })
          },
          joinQuery: async () => {
            const em = connection.em.fork()
            await em
              .getConnection()
              .execute(
                'SELECT u.*, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.status = ? GROUP BY u.id LIMIT 30',
                ['active']
              )
          },
          complexJoin: async () => {
            const em = connection.em.fork()
            await em
              .getConnection()
              .execute(
                'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = ? LIMIT 25',
                [true]
              )
          },
          insert: async () => {
            const { User } = await import(
              '../database/mikro-orm-entities-fixed'
            )
            const em = connection.em.fork()
            const id = `${++this.insertCounter}_${Date.now()}`
            const user = em.create(User, {
              email: `test_${id}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
            await em.persistAndFlush(user)
          }
        }

      default:
        throw new Error(`Unknown driver: ${driver}`)
    }
  }

  private showResults(results: TestResult[]): void {
    console.log(
      chalk.bold.blue('\n📊 Enhanced Benchmark Results - All 10 Drivers')
    )
    console.log(chalk.gray('─'.repeat(90)))

    // Filter out completely failed drivers for main ranking
    const workingResults = results.filter(r => r.operations > 0)
    const failedResults = results.filter(r => r.operations === 0)

    // Sort by ops/sec
    const sorted = workingResults.sort(
      (a, b) => b.opsPerSecond - a.opsPerSecond
    )

    console.log(
      'Driver'.padEnd(16) +
        'Ops/sec'.padStart(10) +
        'Latency'.padStart(10) +
        'P95'.padStart(8) +
        'Errors'.padStart(8) +
        'Status'
    )
    console.log(chalk.gray('─'.repeat(90)))

    // Show working drivers
    sorted.forEach((result, index) => {
      const fastest = sorted[0]?.opsPerSecond || 1
      const relative = Math.round((result.opsPerSecond / fastest) * 100)

      let status = ''
      if (index === 0 && result.errors === 0) {
        status = chalk.green(' ✨ FASTEST')
      } else if (result.errors > 0) {
        const errorRate = (
          (result.errors / (result.operations + result.errors)) *
          100
        ).toFixed(1)
        status = chalk.yellow(` (${errorRate}% errors)`)
      } else {
        status = chalk.gray(` (${relative}%)`)
      }

      console.log(
        result.driver.padEnd(16) +
          result.opsPerSecond.toString().padStart(10) +
          `${result.avgLatency}ms`.padStart(10) +
          `${result.p95Latency}ms`.padStart(8) +
          result.errors.toString().padStart(8) +
          status
      )
    })

    // Show failed drivers
    failedResults.forEach(result => {
      console.log(
        result.driver.padEnd(16) +
          '0'.padStart(10) +
          'N/A'.padStart(10) +
          'N/A'.padStart(8) +
          '1'.padStart(8) +
          chalk.red(' ✗ FAILED')
      )
    })

    // Transaction breakdown for working drivers
    if (workingResults.length > 0) {
      console.log(chalk.bold.blue('\n📈 Transaction Mix Analysis'))
      console.log(chalk.gray('─'.repeat(90)))

      const txTypes = [
        'simpleSelect',
        'filteredSelect',
        'joinQuery',
        'complexJoin',
        'insert'
      ]
      console.log(
        'Transaction'.padEnd(16) +
          workingResults
            .slice(0, 5)
            .map(r => r.driver.padStart(12))
            .join('')
      )
      console.log(chalk.gray('─'.repeat(90)))

      txTypes.forEach(txType => {
        const counts = workingResults
          .slice(0, 5)
          .map(r =>
            (r.transactionBreakdown[txType] || 0).toString().padStart(12)
          )
        console.log(txType.padEnd(16) + counts.join(''))
      })
    }

    console.log(chalk.bold.blue('\n🎯 Summary'))
    console.log(chalk.gray('─'.repeat(90)))
    console.log(`• Working drivers: ${workingResults.length}/10`)
    console.log(`• Failed drivers: ${failedResults.length}/10`)
    if (failedResults.length > 0) {
      console.log(`• Failed: ${failedResults.map(r => r.driver).join(', ')}`)
    }
    console.log(`• Test duration: ${this.TEST_DURATION / 1000}s per driver`)
    console.log(`• Think time: ${this.THINK_TIME ? 'enabled' : 'disabled'}`)
  }

  private async setupEnvironment(): Promise<void> {
    console.log(chalk.yellow('🐳 Starting MySQL container...'))
    this.mysqlContainer = await new GenericContainer('mysql:8.0')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'root',
        MYSQL_DATABASE: 'test_db',
        MYSQL_USER: 'test_user',
        MYSQL_PASSWORD: 'test_pass'
      })
      .withExposedPorts(3306)
      .withStartupTimeout(60000)
      .start()

    console.log(chalk.green('✅ Container started'))

    // Setup database with full schema for compatibility
    await this.setupDatabase()
  }

  private async setupDatabase(): Promise<void> {
    const pool = mysql.createPool({
      host: this.mysqlContainer.getHost(),
      port: this.mysqlContainer.getMappedPort(3306),
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db'
    })

    const conn = pool.promise()

    // Create comprehensive schema for all ORMs
    await conn.execute(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        age INT,
        country VARCHAR(2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status_age (status, age),
        INDEX idx_email (email)
      )
    `)

    await conn.execute(`
      CREATE TABLE categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_parent (parent_id)
      )
    `)

    await conn.execute(`
      CREATE TABLE products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        category_id INT,
        stock_quantity INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category_id),
        INDEX idx_active (is_active),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `)

    await conn.execute(`
      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        shipping_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)

    await conn.execute(`
      CREATE TABLE order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order (order_id),
        INDEX idx_product (product_id),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    await conn.execute(`
      CREATE TABLE reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_product (product_id),
        INDEX idx_rating (rating),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // Seed data quickly
    console.log(chalk.yellow('📝 Seeding data...'))

    // Users
    const users = Array.from({ length: 1000 }, (_, i) => [
      `user${i + 1}@test.com`,
      `First${i + 1}`,
      `Last${i + 1}`,
      'active',
      20 + (i % 50),
      'US'
    ])
    const userPlaceholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO users (email, first_name, last_name, status, age, country) VALUES ${userPlaceholders}`,
      users.flat()
    )

    // Categories
    await conn.execute(
      `INSERT INTO categories (name, description) VALUES ('Electronics', 'Electronic devices'), ('Books', 'Literature'), ('Clothing', 'Apparel')`
    )

    // Products
    const products = Array.from({ length: 500 }, (_, i) => [
      `Product ${i + 1}`,
      `Description ${i + 1}`,
      (Math.random() * 100).toFixed(2),
      (i % 3) + 1,
      Math.floor(Math.random() * 100),
      true
    ])
    const productPlaceholders = products
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ')
    await conn.execute(
      `INSERT INTO products (name, description, price, category_id, stock_quantity, is_active) VALUES ${productPlaceholders}`,
      products.flat()
    )

    // Orders
    const orders = Array.from({ length: 1000 }, (_, i) => [
      Math.floor(Math.random() * 1000) + 1,
      (Math.random() * 500).toFixed(2),
      'pending',
      `Address ${i + 1}`
    ])
    const orderPlaceholders = orders.map(() => '(?, ?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO orders (user_id, total_amount, status, shipping_address) VALUES ${orderPlaceholders}`,
      orders.flat()
    )

    await pool.end()
    console.log(chalk.green('✅ Database ready'))
  }

  private async getConnection(driver: string): Promise<any> {
    if (this.connections.has(driver)) {
      return this.connections.get(driver)
    }

    let connection: any

    switch (driver) {
      case 'MySQL2':
        connection = mysql.createPool({
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          waitForConnections: true,
          connectionLimit: 10
        })
        break

      case 'MySQL2/Promise':
        connection = await mysqlPromise.createPool({
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          waitForConnections: true,
          connectionLimit: 10
        })
        break

      case 'Knex':
        connection = knex({
          client: 'mysql2',
          connection: {
            host: this.mysqlContainer.getHost(),
            port: this.mysqlContainer.getMappedPort(3306),
            user: 'test_user',
            password: 'test_pass',
            database: 'test_db'
          },
          pool: { min: 2, max: 10 }
        })
        break

      case 'Prisma':
        connection = new PrismaClient({
          datasources: {
            db: {
              url: `mysql://test_user:test_pass@${this.mysqlContainer.getHost()}:${this.mysqlContainer.getMappedPort(
                3306
              )}/test_db`
            }
          },
          log: []
        })
        await connection.$connect()
        break

      case 'Kysely': {
        const dialect = new MysqlDialect({
          pool: createPool({
            host: this.mysqlContainer.getHost(),
            port: this.mysqlContainer.getMappedPort(3306),
            user: 'test_user',
            password: 'test_pass',
            database: 'test_db',
            connectionLimit: 10
          })
        })
        connection = new Kysely<Database>({ dialect })
        break
      }

      case 'Drizzle': {
        const pool = createPool({
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          connectionLimit: 10
        })
        connection = drizzle(pool, { schema, mode: 'default' })
        break
      }

      case 'Prisma+Kysely': {
        const basePrisma = new PrismaClient({
          datasources: {
            db: {
              url: `mysql://test_user:test_pass@${this.mysqlContainer.getHost()}:${this.mysqlContainer.getMappedPort(
                3306
              )}/test_db`
            }
          },
          log: []
        })

        const kyselyExtension = (await import('prisma-extension-kysely'))
          .default
        const { MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } =
          await import('kysely')

        connection = basePrisma.$extends(
          kyselyExtension({
            kysely: driver =>
              new Kysely<Database>({
                dialect: {
                  createDriver: () => driver,
                  createAdapter: () => new MysqlAdapter(),
                  createIntrospector: db => new MysqlIntrospector(db),
                  createQueryCompiler: () => new MysqlQueryCompiler()
                }
              })
          })
        )

        await connection.$connect()
        break
      }

      case 'TypeORM': {
        const { User, Product, Category, Order, OrderItem, Review } =
          await import('../database/typeorm-entities')
        connection = new DataSource({
          type: 'mysql',
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          username: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          entities: [User, Product, Category, Order, OrderItem, Review],
          synchronize: false,
          logging: false,
          poolSize: 10
        })
        await connection.initialize()
        break
      }

      case 'Sequelize': {
        connection = new Sequelize({
          dialect: 'mysql',
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          username: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          logging: false,
          pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
        })
        // Initialize models
        const { initSequelizeModels } = await import(
          '../database/sequelize-models'
        )
        initSequelizeModels(connection)
        break
      }

      case 'MikroORM': {
        const {
          User: MikroUser,
          Product: MikroProduct,
          Category: MikroCategory,
          Order: MikroOrder,
          OrderItem: MikroOrderItem,
          Review: MikroReview
        } = await import('../database/mikro-orm-entities-fixed')
        connection = await MikroORM.init({
          driver: MySqlDriver,
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'test_user',
          password: 'test_pass',
          dbName: 'test_db',
          entities: [
            MikroUser,
            MikroProduct,
            MikroCategory,
            MikroOrder,
            MikroOrderItem,
            MikroReview
          ],
          pool: { min: 2, max: 10 },
          debug: false
        })
        break
      }

      default:
        throw new Error(`Unknown driver: ${driver}`)
    }

    this.connections.set(driver, connection)
    return connection
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Cleaning up...'))

    for (const [driver, connection] of this.connections) {
      try {
        switch (driver) {
          case 'MySQL2':
            await connection.end()
            break
          case 'MySQL2/Promise':
            await connection.end()
            break
          case 'Knex':
            await connection.destroy()
            break
          case 'Prisma':
            await connection.$disconnect()
            break
          case 'Kysely':
            await connection.destroy()
            break
          case 'TypeORM':
            await connection.destroy()
            break
          case 'Sequelize':
            await connection.close()
            break
          case 'MikroORM':
            await connection.close()
            break
        }
      } catch (_error) {
        // Ignore cleanup errors
      }
    }

    if (this.mysqlContainer) {
      await this.mysqlContainer.stop()
    }

    console.log(chalk.green('✅ Done'))
  }
}

// Run
if (require.main === module) {
  const benchmark = new EnhancedAllDriversBenchmark()
  benchmark.run().catch(console.error)
}

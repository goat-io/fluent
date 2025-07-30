#!/usr/bin/env node
import { performance } from 'node:perf_hooks'
import { MikroORM } from '@mikro-orm/core'
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
import { MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from 'kysely'
import { kyselyExtension } from 'prisma-extension-kysely'
import { OLTP_WORKLOAD, WorkloadProfile } from './transaction-types'

interface Database {
  users: any
  products: any
  categories: any
  orders: any
  order_items: any
  reviews: any
}

interface TransactionStats {
  name: string
  count: number
  totalLatency: number
  latencies: number[]
  errors: number
}

interface DriverResult {
  driver: string
  totalOperations: number
  totalErrors: number
  duration: number
  operationsPerSecond: number
  avgLatency: number
  p50: number
  p90: number
  p95: number
  p99: number
  transactions: Map<string, TransactionStats>
}

export class CleanEnhancedBenchmark {
  private mysqlContainer!: StartedTestContainer
  private connections: Map<string, any> = new Map()

  // Configuration
  private readonly WARMUP_DURATION = 2000
  private readonly MEASUREMENT_DURATION = 10000 // 10 seconds
  private readonly APPLY_THINK_TIME = process.env.THINK_TIME === 'true' // Toggle via env var

  async run(): Promise<void> {
    try {
      console.log(chalk.bold.blue('🚀 Enhanced Database Benchmark'))
      console.log(chalk.gray('Testing realistic workload patterns'))
      console.log(
        chalk.gray(
          `Think time: ${this.APPLY_THINK_TIME ? 'ENABLED (realistic user simulation)' : 'DISABLED (pure throughput)'}\n`
        )
      )

      await this.setupEnvironment()

      // Test configurations
      const workloads = [OLTP_WORKLOAD]
      const drivers = ['MySQL2', 'MySQL2/Promise', 'Knex', 'Kysely', 'Drizzle'] // Start with core drivers that work reliably

      for (const workload of workloads) {
        console.log(chalk.cyan.bold(`\n📋 ${workload.name} Workload`))
        console.log(chalk.gray(workload.description))
        console.log(`${chalk.gray('─'.repeat(85))}\n`)

        const results: DriverResult[] = []

        // Run benchmark for each driver
        for (const driver of drivers) {
          process.stdout.write(chalk.yellow(`  Testing ${driver}... `))

          try {
            const connection = await this.getConnection(driver)
            const result = await this.benchmarkDriver(
              workload,
              driver,
              connection
            )
            results.push(result)

            console.log(
              chalk.green(
                `✓ ${result.totalOperations} ops @ ${result.operationsPerSecond.toFixed(0)} ops/sec`
              )
            )
          } catch (error) {
            console.log(chalk.red(`✗ Error: ${error}`))
          }
        }

        // Display results
        this.displayResults(workload.name, results)
        this.displayTransactionBreakdown(results)
      }

      // Compare with/without think time
      if (this.APPLY_THINK_TIME) {
        console.log(
          chalk.yellow.bold('\n📊 Running comparison without think time...')
        )
        this.APPLY_THINK_TIME = false
        // Run quick test without think time for comparison
      }
    } catch (error) {
      console.error(chalk.red('❌ Benchmark failed:'), error)
    } finally {
      await this.cleanup()
    }
  }

  private async benchmarkDriver(
    workload: WorkloadProfile,
    driver: string,
    connection: any
  ): Promise<DriverResult> {
    const transactions = new Map<string, TransactionStats>()

    // Initialize transaction stats
    workload.transactions.forEach(tx => {
      transactions.set(tx.name, {
        name: tx.name,
        count: 0,
        totalLatency: 0,
        latencies: [],
        errors: 0
      })
    })

    // Get transaction implementations
    const executors = this.getTransactionExecutors(driver, connection)

    // Warmup phase
    const warmupEnd = Date.now() + this.WARMUP_DURATION
    while (Date.now() < warmupEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      try {
        await executors[tx.name]()
      } catch (_error) {
        // Ignore warmup errors
      }
    }

    // Measurement phase
    const measurementStart = Date.now()
    const measurementEnd = measurementStart + this.MEASUREMENT_DURATION
    let totalOperations = 0
    let totalErrors = 0
    const allLatencies: number[] = []

    while (Date.now() < measurementEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      const stats = transactions.get(tx.name)!

      // Optional: Apply keying time (simulating user input time)
      if (this.APPLY_THINK_TIME) {
        const keyingTime = this.getThinkTime(workload.thinkTime.keyingTime)
        await new Promise(resolve => setTimeout(resolve, keyingTime))
      }

      const startTime = performance.now()
      try {
        await executors[tx.name]()
        const latency = performance.now() - startTime

        stats.count++
        stats.totalLatency += latency
        stats.latencies.push(latency)
        allLatencies.push(latency)
        totalOperations++

        // Optional: Apply thinking time (simulating user processing time)
        if (this.APPLY_THINK_TIME) {
          const thinkingTime = this.getThinkTime(
            workload.thinkTime.thinkingTime
          )
          await new Promise(resolve => setTimeout(resolve, thinkingTime))
        }
      } catch (_error) {
        stats.errors++
        totalErrors++
      }
    }

    const duration = Date.now() - measurementStart

    // Calculate percentiles
    const sortedLatencies = [...allLatencies].sort((a, b) => a - b)

    return {
      driver,
      totalOperations,
      totalErrors,
      duration,
      operationsPerSecond: (totalOperations / duration) * 1000,
      avgLatency:
        allLatencies.length > 0
          ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
          : 0,
      p50: this.getPercentile(sortedLatencies, 50),
      p90: this.getPercentile(sortedLatencies, 90),
      p95: this.getPercentile(sortedLatencies, 95),
      p99: this.getPercentile(sortedLatencies, 99),
      transactions
    }
  }

  private getThinkTime(range: { min: number; max: number }): number {
    // Simple uniform distribution for now
    return Math.random() * (range.max - range.min) + range.min
  }

  private selectWeightedTransaction(transactions: any[]): any {
    const totalWeight = transactions.reduce((sum, t) => sum + t.weight, 0)
    let random = Math.random() * totalWeight

    for (const transaction of transactions) {
      random -= transaction.weight
      if (random <= 0) {
        return transaction
      }
    }

    return transactions[transactions.length - 1]
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) {
      return 0
    }
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  private displayResults(workloadName: string, results: DriverResult[]): void {
    console.log(chalk.bold(`\n📊 ${workloadName} Results`))
    console.log(chalk.gray('─'.repeat(85)))

    // Header
    console.log(
      'Driver'.padEnd(16) +
        'Ops/sec'.padStart(10) +
        'Latency'.padStart(10) +
        '   P50'.padStart(8) +
        '   P90'.padStart(8) +
        '   P95'.padStart(8) +
        '   P99'.padStart(8) +
        ' Errors'.padStart(8) +
        ' Status'
    )
    console.log(chalk.gray('─'.repeat(85)))

    // Sort by ops/sec
    const sorted = [...results].sort(
      (a, b) => b.operationsPerSecond - a.operationsPerSecond
    )
    const fastest = sorted[0]?.operationsPerSecond || 1

    sorted.forEach((result, index) => {
      const relative = ((result.operationsPerSecond / fastest) * 100).toFixed(0)
      const errorRate =
        result.totalOperations > 0
          ? ((result.totalErrors / result.totalOperations) * 100).toFixed(1)
          : '0.0'

      const line =
        result.driver.padEnd(16) +
        result.operationsPerSecond.toFixed(0).padStart(10) +
        `${result.avgLatency.toFixed(1)}ms`.padStart(10) +
        `${result.p50.toFixed(0)}ms`.padStart(8) +
        `${result.p90.toFixed(0)}ms`.padStart(8) +
        `${result.p95.toFixed(0)}ms`.padStart(8) +
        `${result.p99.toFixed(0)}ms`.padStart(8) +
        result.totalErrors.toString().padStart(8)

      let status = ''
      if (index === 0 && result.totalErrors === 0) {
        status = chalk.green(' ✨ FASTEST')
      } else if (result.totalErrors > 0) {
        status = chalk.red(` (${errorRate}% errors)`)
      } else {
        status = chalk.gray(` (${relative}%)`)
      }

      console.log(line + status)
    })
  }

  private displayTransactionBreakdown(results: DriverResult[]): void {
    console.log(chalk.bold('\n📈 Transaction Breakdown'))
    console.log(
      chalk.gray('Shows how each driver handled different transaction types')
    )
    console.log(chalk.gray('─'.repeat(85)))

    // Get all transaction types
    const txTypes = new Set<string>()
    results.forEach(r => r.transactions.forEach((_, name) => txTypes.add(name)))

    // Header
    console.log(
      'Transaction'.padEnd(20) +
        results.map(r => r.driver.padStart(12)).join('')
    )
    console.log(chalk.gray('─'.repeat(85)))

    // Show ops/sec for each transaction type
    txTypes.forEach(txName => {
      const values = results.map(r => {
        const stats = r.transactions.get(txName)
        if (!stats || stats.count === 0) {
          return '0'.padStart(12)
        }
        const opsPerSec = (stats.count / (r.duration / 1000)).toFixed(0)
        return opsPerSec.padStart(12)
      })

      console.log(txName.padEnd(20) + values.join(''))
    })
  }

  private getTransactionExecutors(
    driver: string,
    connection: any
  ): Record<string, () => Promise<void>> {
    // Simplified transaction implementations focusing on the main patterns
    const userId = () => Math.floor(Math.random() * 1000) + 1
    const age = () => 20 + Math.floor(Math.random() * 40)

    switch (driver) {
      case 'MySQL2':
        return {
          simpleSelect: async () => {
            await connection
              .promise()
              .execute('SELECT * FROM users WHERE id = ?', [userId()])
          },
          filteredSelect: async () => {
            await connection
              .promise()
              .execute(
                'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
                ['active', age()]
              )
          },
          joinQuery: async () => {
            await connection.promise().execute(`
              SELECT u.*, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `)
          },
          complexJoin: async () => {
            await connection.promise().execute(`
              SELECT p.*, c.name as category_name, COUNT(r.id) as review_count
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.id
              LEFT JOIN reviews r ON p.id = r.product_id
              WHERE p.is_active = true
              GROUP BY p.id
              LIMIT 25
            `)
          },
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
          simpleSelect: async () => {
            await connection.execute('SELECT * FROM users WHERE id = ?', [
              userId()
            ])
          },
          filteredSelect: async () => {
            await connection.execute(
              'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
              ['active', age()]
            )
          },
          joinQuery: async () => {
            await connection.execute(`
              SELECT u.*, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `)
          },
          complexJoin: async () => {
            await connection.execute(`
              SELECT p.*, c.name as category_name, COUNT(r.id) as review_count
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.id
              LEFT JOIN reviews r ON p.id = r.product_id
              WHERE p.is_active = true
              GROUP BY p.id
              LIMIT 25
            `)
          },
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
          simpleSelect: async () => {
            await connection('users').where('id', userId()).first()
          },
          filteredSelect: async () => {
            await connection('users')
              .where('status', 'active')
              .where('age', '>', age())
              .limit(50)
          },
          joinQuery: async () => {
            await connection('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select('u.*')
              .select(connection.raw('COUNT(o.id) as order_count'))
              .where('u.status', 'active')
              .groupBy('u.id')
              .limit(30)
          },
          complexJoin: async () => {
            await connection('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .leftJoin('reviews as r', 'p.id', 'r.product_id')
              .select('p.*')
              .select('c.name as category_name')
              .select(connection.raw('COUNT(r.id) as review_count'))
              .where('p.is_active', true)
              .groupBy('p.id')
              .limit(25)
          },
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
          simpleSelect: async () => {
            await connection.user.findUnique({ where: { id: userId() } })
          },
          filteredSelect: async () => {
            await connection.user.findMany({
              where: { status: 'active', age: { gt: age() } },
              take: 50
            })
          },
          joinQuery: async () => {
            await connection.user.findMany({
              where: { status: 'active' },
              include: { orders: true },
              take: 30
            })
          },
          complexJoin: async () => {
            await connection.product.findMany({
              where: { isActive: true },
              include: { category: true, reviews: true },
              take: 25
            })
          },
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
          simpleSelect: async () => {
            await connection
              .selectFrom('users')
              .where('id', '=', userId())
              .selectAll()
              .executeTakeFirst()
          },
          filteredSelect: async () => {
            await connection
              .selectFrom('users')
              .where('status', '=', 'active')
              .where('age', '>', age())
              .selectAll()
              .limit(50)
              .execute()
          },
          joinQuery: async () => {
            await connection
              .selectFrom('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select(['u.id', 'u.email', 'u.first_name', 'u.last_name'])
              .select(connection.fn.count('o.id').as('order_count'))
              .where('u.status', '=', 'active')
              .groupBy('u.id')
              .limit(30)
              .execute()
          },
          complexJoin: async () => {
            await connection
              .selectFrom('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .leftJoin('reviews as r', 'p.id', 'r.product_id')
              .select(['p.id', 'p.name', 'p.price'])
              .select('c.name as category_name')
              .select(connection.fn.count('r.id').as('review_count'))
              .where('p.is_active', '=', true)
              .groupBy('p.id')
              .limit(25)
              .execute()
          },
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
          simpleSelect: async () => {
            await connection
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, userId()))
          },
          filteredSelect: async () => {
            await connection
              .select()
              .from(schema.users)
              .where(
                and(
                  eq(schema.users.status, 'active'),
                  gt(schema.users.age, age())
                )
              )
              .limit(50)
          },
          joinQuery: async () => {
            await connection
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
              .limit(30)
          },
          complexJoin: async () => {
            await connection
              .select({
                id: schema.products.id,
                name: schema.products.name,
                categoryName: schema.categories.name,
                reviewCount: drizzleSql<number>`count(${schema.reviews.id})`
              })
              .from(schema.products)
              .leftJoin(
                schema.categories,
                eq(schema.products.categoryId, schema.categories.id)
              )
              .leftJoin(
                schema.reviews,
                eq(schema.products.id, schema.reviews.productId)
              )
              .where(eq(schema.products.isActive, true))
              .groupBy(schema.products.id)
              .limit(25)
          },
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
          simpleSelect: async () => {
            await connection.$kysely
              .selectFrom('users')
              .where('id', '=', userId())
              .selectAll()
              .executeTakeFirst()
          },
          filteredSelect: async () => {
            await connection.$kysely
              .selectFrom('users')
              .where('status', '=', 'active')
              .where('age', '>', age())
              .selectAll()
              .limit(50)
              .execute()
          },
          joinQuery: async () => {
            await connection.$kysely
              .selectFrom('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select(['u.id', 'u.email', 'u.first_name', 'u.last_name'])
              .select(connection.$kysely.fn.count('o.id').as('order_count'))
              .where('u.status', '=', 'active')
              .groupBy('u.id')
              .limit(30)
              .execute()
          },
          complexJoin: async () => {
            await connection.$kysely
              .selectFrom('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .leftJoin('reviews as r', 'p.id', 'r.product_id')
              .select(['p.id', 'p.name', 'p.price'])
              .select('c.name as category_name')
              .select(connection.$kysely.fn.count('r.id').as('review_count'))
              .where('p.is_active', '=', true)
              .groupBy('p.id')
              .limit(25)
              .execute()
          },
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
              .createQueryBuilder('user')
              .where('user.status = :status', { status: 'active' })
              .andWhere('user.age > :age', { age: age() })
              .limit(50)
              .getMany()
          },
          joinQuery: async () => {
            const { User } = await import('../database/typeorm-entities')
            await connection
              .getRepository(User)
              .createQueryBuilder('u')
              .leftJoin('u.orders', 'o')
              .select(['u.id', 'u.email', 'u.firstName', 'u.lastName'])
              .addSelect('COUNT(o.id)', 'order_count')
              .where('u.status = :status', { status: 'active' })
              .groupBy('u.id')
              .limit(30)
              .getRawMany()
          },
          complexJoin: async () => {
            const { Product } = await import('../database/typeorm-entities')
            await connection
              .getRepository(Product)
              .createQueryBuilder('p')
              .leftJoin('p.category', 'c')
              .leftJoin('p.reviews', 'r')
              .select(['p.id', 'p.name', 'p.price'])
              .addSelect('c.name', 'category_name')
              .addSelect('COUNT(r.id)', 'review_count')
              .where('p.isActive = :isActive', { isActive: true })
              .groupBy('p.id')
              .limit(25)
              .getRawMany()
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
            const { Op } = await import('sequelize')
            await User.findAll({
              where: {
                status: 'active',
                age: { [Op.gt]: age() }
              },
              limit: 50
            })
          },
          joinQuery: async () => {
            await connection.query(
              `
              SELECT u.id, u.email, u.first_name, u.last_name, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `,
              { type: connection.QueryTypes.SELECT }
            )
          },
          complexJoin: async () => {
            await connection.query(
              `
              SELECT p.id, p.name, p.price, c.name as category_name, COUNT(r.id) as review_count
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.id
              LEFT JOIN reviews r ON p.id = r.product_id
              WHERE p.is_active = true
              GROUP BY p.id
              LIMIT 25
            `,
              { type: connection.QueryTypes.SELECT }
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
            await em.find(
              User,
              {
                status: 'active',
                age: { $gt: age() }
              },
              { limit: 50 }
            )
          },
          joinQuery: async () => {
            const em = connection.em.fork()
            await em.getConnection().execute(`
              SELECT u.id, u.email, u.first_name, u.last_name, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `)
          },
          complexJoin: async () => {
            const em = connection.em.fork()
            await em.getConnection().execute(`
              SELECT p.id, p.name, p.price, c.name as category_name, COUNT(r.id) as review_count
              FROM products p
              LEFT JOIN categories c ON p.category_id = c.id
              LEFT JOIN reviews r ON p.id = r.product_id
              WHERE p.is_active = true
              GROUP BY p.id
              LIMIT 25
            `)
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

  private async setupEnvironment(): Promise<void> {
    console.log(chalk.yellow('🐳 Starting MySQL container...'))
    this.mysqlContainer = await new GenericContainer('mysql:8.0')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'root',
        MYSQL_DATABASE: 'benchmark_db',
        MYSQL_USER: 'benchmark_user',
        MYSQL_PASSWORD: 'benchmark_pass'
      })
      .withExposedPorts(3306)
      .withStartupTimeout(60000)
      .start()

    console.log(chalk.green('✅ Container started'))

    // Setup database with fixed schema
    await this.setupDatabase()
  }

  private async setupDatabase(): Promise<void> {
    const pool = mysql.createPool({
      host: this.mysqlContainer.getHost(),
      port: this.mysqlContainer.getMappedPort(3306),
      user: 'benchmark_user',
      password: 'benchmark_pass',
      database: 'benchmark_db'
    })

    const conn = pool.promise()

    // Create tables with updated_at for Prisma compatibility
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        age INT,
        country VARCHAR(2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_age (age),
        INDEX idx_status_age (status, age)
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
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
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_product (product_id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)

    // Seed data
    console.log(chalk.yellow('📝 Seeding data...'))

    // Seed users
    const users = []
    for (let i = 1; i <= 1000; i++) {
      users.push([
        `user${i}@example.com`,
        `First${i}`,
        `Last${i}`,
        i % 10 === 0 ? 'inactive' : 'active',
        20 + (i % 50),
        ['US', 'UK', 'CA', 'AU', 'DE'][i % 5]
      ])
    }

    const userPlaceholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO users (email, first_name, last_name, status, age, country) VALUES ${userPlaceholders}`,
      users.flat()
    )

    // Seed categories
    await conn.execute(`
      INSERT INTO categories (name, description) VALUES 
      ('Electronics', 'Electronic devices'),
      ('Books', 'Literature and education'),
      ('Clothing', 'Fashion and apparel'),
      ('Home', 'Home and garden'),
      ('Sports', 'Sports and outdoors')
    `)

    // Seed products
    const products = []
    for (let i = 1; i <= 500; i++) {
      products.push([
        `Product ${i}`,
        `Description for product ${i}`,
        (Math.random() * 1000).toFixed(2),
        (i % 5) + 1,
        Math.floor(Math.random() * 100),
        i % 20 !== 0
      ])
    }

    const productPlaceholders = products
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ')
    await conn.execute(
      `INSERT INTO products (name, description, price, category_id, stock_quantity, is_active) VALUES ${productPlaceholders}`,
      products.flat()
    )

    // Seed orders
    const orders = []
    for (let i = 1; i <= 2000; i++) {
      orders.push([
        Math.floor(Math.random() * 1000) + 1,
        (Math.random() * 500).toFixed(2),
        ['pending', 'completed', 'cancelled'][i % 3]
      ])
    }

    const orderPlaceholders = orders.map(() => '(?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO orders (user_id, total_amount, status) VALUES ${orderPlaceholders}`,
      orders.flat()
    )

    // Seed reviews
    const reviews = []
    for (let i = 1; i <= 1000; i++) {
      reviews.push([
        Math.floor(Math.random() * 500) + 1,
        Math.floor(Math.random() * 1000) + 1,
        Math.floor(Math.random() * 5) + 1,
        `Review comment ${i}`
      ])
    }

    const reviewPlaceholders = reviews.map(() => '(?, ?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ${reviewPlaceholders}`,
      reviews.flat()
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
          user: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
          waitForConnections: true,
          connectionLimit: 10
        })
        break

      case 'MySQL2/Promise':
        connection = await mysqlPromise.createPool({
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
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
            user: 'benchmark_user',
            password: 'benchmark_pass',
            database: 'benchmark_db'
          },
          pool: { min: 2, max: 10 }
        })
        break

      case 'Prisma':
        connection = new PrismaClient({
          datasources: {
            db: {
              url: `mysql://benchmark_user:benchmark_pass@${this.mysqlContainer.getHost()}:${this.mysqlContainer.getMappedPort(3306)}/benchmark_db`
            }
          },
          log: ['error']
        })
        await connection.$connect()
        break

      case 'Kysely': {
        const dialect = new MysqlDialect({
          pool: createPool({
            host: this.mysqlContainer.getHost(),
            port: this.mysqlContainer.getMappedPort(3306),
            user: 'benchmark_user',
            password: 'benchmark_pass',
            database: 'benchmark_db',
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
          user: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
          connectionLimit: 10
        })
        connection = drizzle(pool, { schema, mode: 'default' })
        break
      }

      case 'Prisma+Kysely': {
        const basePrisma = new PrismaClient({
          datasources: {
            db: {
              url: `mysql://benchmark_user:benchmark_pass@${this.mysqlContainer.getHost()}:${this.mysqlContainer.getMappedPort(3306)}/benchmark_db`
            }
          },
          log: ['error']
        })

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
          username: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
          entities: [User, Product, Category, Order, OrderItem, Review],
          synchronize: false,
          logging: false,
          poolSize: 10
        })

        await connection.initialize()
        break
      }

      case 'Sequelize':
        connection = new Sequelize({
          dialect: 'mysql',
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          username: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
          logging: false,
          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
          }
        })
        break

      case 'MikroORM':
        connection = await MikroORM.init({
          type: 'mysql',
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'benchmark_user',
          password: 'benchmark_pass',
          dbName: 'benchmark_db',
          entities: ['../database/mikro-orm-entities-fixed.ts'],
          pool: { min: 2, max: 10 },
          debug: false
        })
        break

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
          case 'Prisma+Kysely':
            await connection.$disconnect()
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
          // Drizzle uses the MySQL2 pool which should be closed automatically
        }
      } catch (error) {
        console.error(`Error closing ${driver}:`, error)
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
  const benchmark = new CleanEnhancedBenchmark()
  benchmark.run().catch(console.error)
}

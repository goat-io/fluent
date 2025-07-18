import chalk from 'chalk'
import { performance } from 'perf_hooks'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import * as mysql from 'mysql2'
import * as mysqlPromise from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from '../database/drizzle-schema'
import { and, eq, gt, sql as drizzleSql } from 'drizzle-orm'
import { sql } from 'kysely'
import knex, { Knex } from 'knex'
import { OLTP_WORKLOAD, ECOMMERCE_WORKLOAD, WorkloadProfile } from './transaction-types'
import { kyselyExtension } from 'prisma-extension-kysely'
import {
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from 'kysely'

interface Database {
  users: any
  products: any
  categories: any
  orders: any
  order_items: any
  reviews: any
}

interface BenchmarkResult {
  name: string
  description: string
  totalTime: number
  iterations: number
  errors: number
  operationsPerSecond: number
  averageLatency: number
  p50: number
  p90: number
  p95: number
  p99: number
}

interface ScenarioResult {
  scenario: string
  workload: string
  results: BenchmarkResult[]
}

export class FixedEnhancedBenchmark {
  private mysqlContainer!: StartedTestContainer
  private connections: Map<string, any> = new Map()
  private insertCounter = 0

  // Fixed measurement duration without think time interference
  private readonly MEASUREMENT_DURATION = 10000 // 10 seconds
  private readonly WARMUP_DURATION = 2000
  
  async runBenchmark(): Promise<void> {
    try {
      console.log(chalk.bold.blue('🚀 Enhanced Database Benchmark Suite'))
      console.log(chalk.gray('Fixed calculations with clear output format\n'))
      
      await this.setupEnvironment()
      
      const workloads = [OLTP_WORKLOAD, ECOMMERCE_WORKLOAD]
      const drivers = ['MySQL2', 'MySQL2/Promise', 'Knex', 'Prisma', 'Kysely', 'Drizzle']
      
      const allResults: ScenarioResult[] = []
      
      for (const workload of workloads) {
        console.log(chalk.cyan.bold(`\n📋 Testing ${workload.name} Workload`))
        console.log(chalk.gray(workload.description))
        console.log(chalk.gray('─'.repeat(80)))
        
        const workloadResults: BenchmarkResult[] = []
        
        for (const driver of drivers) {
          console.log(chalk.yellow(`\n  Testing ${driver}...`))
          
          try {
            const connection = await this.getConnection(driver)
            const result = await this.runDriverBenchmark(workload, driver, connection)
            workloadResults.push(result)
            
            // Immediate feedback
            console.log(chalk.green(`    ✓ ${result.iterations} operations, ${result.operationsPerSecond.toFixed(0)} ops/sec`))
          } catch (error) {
            console.error(chalk.red(`    ✗ Error: ${error}`))
          }
        }
        
        allResults.push({
          scenario: workload.name,
          workload: workload.name,
          results: workloadResults
        })
        
        // Show results for this workload
        this.printWorkloadResults(workload.name, workloadResults)
      }
      
      // Show overall summary
      this.printOverallSummary(allResults)
      
    } catch (error) {
      console.error(chalk.red('❌ Benchmark failed:'), error)
      process.exit(1)
    } finally {
      await this.cleanup()
    }
  }

  private async runDriverBenchmark(
    workload: WorkloadProfile,
    driver: string,
    connection: any
  ): Promise<BenchmarkResult> {
    const latencies: number[] = []
    let operations = 0
    let errors = 0
    
    // Create transaction executors
    const transactions = this.createTransactionExecutors(driver, connection)
    
    // Warmup phase
    const warmupEnd = Date.now() + this.WARMUP_DURATION
    while (Date.now() < warmupEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      try {
        await transactions[tx.name]()
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Measurement phase - NO THINK TIME during measurement
    const measurementStart = Date.now()
    const measurementEnd = measurementStart + this.MEASUREMENT_DURATION
    
    while (Date.now() < measurementEnd) {
      const tx = this.selectWeightedTransaction(workload.transactions)
      
      const startTime = performance.now()
      try {
        await transactions[tx.name]()
        const endTime = performance.now()
        const latency = endTime - startTime
        
        latencies.push(latency)
        operations++
      } catch (error) {
        errors++
      }
    }
    
    const actualDuration = Date.now() - measurementStart
    
    // Calculate metrics
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const totalTime = latencies.reduce((sum, l) => sum + l, 0)
    
    return {
      name: driver,
      description: workload.name,
      totalTime: actualDuration,
      iterations: operations,
      errors,
      operationsPerSecond: (operations / actualDuration) * 1000,
      averageLatency: operations > 0 ? totalTime / operations : 0,
      p50: this.getPercentile(sortedLatencies, 50),
      p90: this.getPercentile(sortedLatencies, 90),
      p95: this.getPercentile(sortedLatencies, 95),
      p99: this.getPercentile(sortedLatencies, 99)
    }
  }

  private createTransactionExecutors(driver: string, connection: any): Record<string, () => Promise<void>> {
    switch (driver) {
      case 'MySQL2':
        return {
          simpleSelect: async () => {
            const id = Math.floor(Math.random() * 1000) + 1
            await connection.promise().execute('SELECT * FROM users WHERE id = ?', [id])
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection.promise().execute(
              'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
              ['active', age]
            )
          },
          joinQuery: async () => {
            await connection.promise().execute(`
              SELECT u.id, u.email, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `)
          },
          complexJoin: async () => {
            await connection.promise().execute(`
              SELECT p.id, p.name, c.name as category_name, COUNT(r.id) as review_count
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
            await connection.promise().execute(
              'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
              [`bench_${id}@test.com`, 'Test', 'User', 'active', 30, 'US']
            )
          }
        }
      
      case 'MySQL2/Promise':
        return {
          simpleSelect: async () => {
            const id = Math.floor(Math.random() * 1000) + 1
            await connection.execute('SELECT * FROM users WHERE id = ?', [id])
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection.execute(
              'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
              ['active', age]
            )
          },
          joinQuery: async () => {
            await connection.execute(`
              SELECT u.id, u.email, COUNT(o.id) as order_count
              FROM users u
              LEFT JOIN orders o ON u.id = o.user_id
              WHERE u.status = 'active'
              GROUP BY u.id
              LIMIT 30
            `)
          },
          complexJoin: async () => {
            await connection.execute(`
              SELECT p.id, p.name, c.name as category_name, COUNT(r.id) as review_count
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
              [`bench_${id}@test.com`, 'Test', 'User', 'active', 30, 'US']
            )
          }
        }

      case 'Knex':
        return {
          simpleSelect: async () => {
            const id = Math.floor(Math.random() * 1000) + 1
            await connection('users').where('id', id).first()
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection('users')
              .where('status', 'active')
              .where('age', '>', age)
              .limit(50)
          },
          joinQuery: async () => {
            await connection('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select('u.id', 'u.email')
              .select(connection.raw('COUNT(o.id) as order_count'))
              .where('u.status', 'active')
              .groupBy('u.id')
              .limit(30)
          },
          complexJoin: async () => {
            await connection('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .leftJoin('reviews as r', 'p.id', 'r.product_id')
              .select('p.id', 'p.name')
              .select('c.name as category_name')
              .select(connection.raw('COUNT(r.id) as review_count'))
              .where('p.is_active', true)
              .groupBy('p.id')
              .limit(25)
          },
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection('users').insert({
              email: `bench_${id}@test.com`,
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
            const id = Math.floor(Math.random() * 1000) + 1
            await connection.user.findUnique({ where: { id } })
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection.user.findMany({
              where: { status: 'active', age: { gt: age } },
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
                email: `bench_${id}@test.com`,
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
            const id = Math.floor(Math.random() * 1000) + 1
            await connection.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst()
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection.selectFrom('users')
              .where('status', '=', 'active')
              .where('age', '>', age)
              .selectAll()
              .limit(50)
              .execute()
          },
          joinQuery: async () => {
            await connection.selectFrom('users as u')
              .leftJoin('orders as o', 'u.id', 'o.user_id')
              .select(['u.id', 'u.email'])
              .select(connection.fn.count('o.id').as('order_count'))
              .where('u.status', '=', 'active')
              .groupBy('u.id')
              .limit(30)
              .execute()
          },
          complexJoin: async () => {
            await connection.selectFrom('products as p')
              .leftJoin('categories as c', 'p.category_id', 'c.id')
              .leftJoin('reviews as r', 'p.id', 'r.product_id')
              .select(['p.id', 'p.name'])
              .select('c.name as category_name')
              .select(connection.fn.count('r.id').as('review_count'))
              .where('p.is_active', '=', true)
              .groupBy('p.id')
              .limit(25)
              .execute()
          },
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.insertInto('users').values({
              email: `bench_${id}@test.com`,
              first_name: 'Test',
              last_name: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            }).execute()
          }
        }

      case 'Drizzle':
        return {
          simpleSelect: async () => {
            const id = Math.floor(Math.random() * 1000) + 1
            await connection.select().from(schema.users).where(eq(schema.users.id, id))
          },
          filteredSelect: async () => {
            const age = 20 + Math.floor(Math.random() * 40)
            await connection.select().from(schema.users)
              .where(and(
                eq(schema.users.status, 'active'),
                gt(schema.users.age, age)
              ))
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
              .leftJoin(schema.orders, eq(schema.users.id, schema.orders.userId))
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
              .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
              .leftJoin(schema.reviews, eq(schema.products.id, schema.reviews.productId))
              .where(eq(schema.products.isActive, true))
              .groupBy(schema.products.id)
              .limit(25)
          },
          insert: async () => {
            const id = `${++this.insertCounter}_${Date.now()}`
            await connection.insert(schema.users).values({
              email: `bench_${id}@test.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
          }
        }

      default:
        throw new Error(`Unknown driver: ${driver}`)
    }
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
    if (sortedArray.length === 0) return 0
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, index)]
  }

  private printWorkloadResults(workloadName: string, results: BenchmarkResult[]): void {
    console.log(chalk.bold(`\n📊 ${workloadName} Results`))
    console.log(chalk.gray('─'.repeat(80)))
    
    // Sort by ops/sec
    const sorted = [...results].sort((a, b) => b.operationsPerSecond - a.operationsPerSecond)
    
    // Header
    console.log(
      'Driver'.padEnd(15) +
      'Ops/sec'.padStart(12) +
      'Avg Latency'.padStart(12) +
      'P50'.padStart(8) +
      'P90'.padStart(8) +
      'P95'.padStart(8) +
      'P99'.padStart(8) +
      'Errors'.padStart(8)
    )
    console.log(chalk.gray('─'.repeat(80)))
    
    // Results
    sorted.forEach((result, index) => {
      const line = 
        result.name.padEnd(15) +
        result.operationsPerSecond.toFixed(0).padStart(12) +
        `${result.averageLatency.toFixed(1)}ms`.padStart(12) +
        `${result.p50.toFixed(0)}ms`.padStart(8) +
        `${result.p90.toFixed(0)}ms`.padStart(8) +
        `${result.p95.toFixed(0)}ms`.padStart(8) +
        `${result.p99.toFixed(0)}ms`.padStart(8) +
        result.errors.toString().padStart(8)
      
      if (index === 0) {
        console.log(chalk.green(line + ' ✨'))
      } else {
        const relative = ((result.operationsPerSecond / sorted[0].operationsPerSecond) * 100).toFixed(0)
        console.log(line + chalk.gray(` (${relative}%)`))
      }
    })
  }

  private printOverallSummary(allResults: ScenarioResult[]): void {
    console.log(chalk.bold.blue('\n\n📈 OVERALL PERFORMANCE SUMMARY'))
    console.log(chalk.gray('═'.repeat(80)))
    
    // Calculate average performance across all workloads for each driver
    const driverStats = new Map<string, { totalOps: number; count: number; wins: number }>()
    
    allResults.forEach(scenario => {
      const winner = scenario.results.sort((a, b) => b.operationsPerSecond - a.operationsPerSecond)[0]
      
      scenario.results.forEach(result => {
        if (!driverStats.has(result.name)) {
          driverStats.set(result.name, { totalOps: 0, count: 0, wins: 0 })
        }
        const stats = driverStats.get(result.name)!
        stats.totalOps += result.operationsPerSecond
        stats.count++
        if (result.name === winner.name) {
          stats.wins++
        }
      })
    })
    
    // Sort by average ops/sec
    const sorted = Array.from(driverStats.entries())
      .map(([driver, stats]) => ({
        driver,
        avgOps: stats.totalOps / stats.count,
        wins: stats.wins
      }))
      .sort((a, b) => b.avgOps - a.avgOps)
    
    console.log('Driver'.padEnd(15) + 'Avg Ops/sec'.padStart(15) + 'Wins'.padStart(10))
    console.log(chalk.gray('─'.repeat(40)))
    
    sorted.forEach((stat, index) => {
      const medal = index === 0 ? ' 🥇' : index === 1 ? ' 🥈' : index === 2 ? ' 🥉' : ''
      console.log(
        (stat.driver + medal).padEnd(15) +
        stat.avgOps.toFixed(0).padStart(15) +
        `${stat.wins}/${allResults.length}`.padStart(10)
      )
    })
    
    console.log(chalk.gray('\n═'.repeat(80)))
  }

  private async setupEnvironment(): Promise<void> {
    console.log(chalk.yellow('🐳 Starting MySQL container...'))
    this.mysqlContainer = await new GenericContainer('mysql:8.0')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'root',
        MYSQL_DATABASE: 'benchmark_db',
        MYSQL_USER: 'benchmark_user',
        MYSQL_PASSWORD: 'benchmark_pass',
      })
      .withExposedPorts(3306)
      .withStartupTimeout(60000)
      .start()

    console.log(chalk.green('✅ MySQL container started'))
    
    // Setup database schema
    await this.setupDatabase()
  }

  private async setupDatabase(): Promise<void> {
    const pool = mysql.createPool({
      host: this.mysqlContainer.getHost(),
      port: this.mysqlContainer.getMappedPort(3306),
      user: 'benchmark_user',
      password: 'benchmark_pass',
      database: 'benchmark_db',
    })

    const conn = pool.promise()
    
    // Create tables
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
        
        INDEX idx_status (status),
        INDEX idx_age (age),
        INDEX idx_status_age (status, age)
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id INT,
        is_active BOOLEAN DEFAULT true,
        
        INDEX idx_category (category_id),
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
        
        INDEX idx_product (product_id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `)

    // Seed data
    console.log(chalk.yellow('📝 Seeding test data...'))
    
    // Users
    const users = []
    for (let i = 1; i <= 1000; i++) {
      users.push([
        `user${i}@test.com`,
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

    // Categories
    await conn.execute(`
      INSERT INTO categories (name, description) VALUES 
      ('Electronics', 'Electronic devices'),
      ('Books', 'Literature and education'),
      ('Clothing', 'Fashion and apparel'),
      ('Home', 'Home and garden'),
      ('Sports', 'Sports and outdoors')
    `)

    // Products
    const products = []
    for (let i = 1; i <= 500; i++) {
      products.push([
        `Product ${i}`,
        `Description for product ${i}`,
        (Math.random() * 1000).toFixed(2),
        (i % 5) + 1,
        i % 20 !== 0
      ])
    }
    
    const productPlaceholders = products.map(() => '(?, ?, ?, ?, ?)').join(', ')
    await conn.execute(
      `INSERT INTO products (name, description, price, category_id, is_active) VALUES ${productPlaceholders}`,
      products.flat()
    )

    // Orders
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

    // Reviews
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
    console.log(chalk.green('✅ Database setup complete'))
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
          connectionLimit: 10,
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
          connectionLimit: 10,
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
            database: 'benchmark_db',
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

      case 'Kysely':
        const dialect = new MysqlDialect({
          pool: createPool({
            host: this.mysqlContainer.getHost(),
            port: this.mysqlContainer.getMappedPort(3306),
            user: 'benchmark_user',
            password: 'benchmark_pass',
            database: 'benchmark_db',
            connectionLimit: 10,
          })
        })
        connection = new Kysely<Database>({ dialect })
        break

      case 'Drizzle':
        const pool = createPool({
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db',
          connectionLimit: 10,
        })
        connection = drizzle(pool, { schema, mode: 'default' })
        break

      default:
        throw new Error(`Unknown driver: ${driver}`)
    }

    this.connections.set(driver, connection)
    return connection
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Cleaning up...'))
    
    // Close all connections
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
          // Drizzle uses MySQL2 pool which is already closed
        }
      } catch (error) {
        console.error(`Error closing ${driver}:`, error)
      }
    }
    
    // Stop container
    if (this.mysqlContainer) {
      await this.mysqlContainer.stop()
    }
    
    console.log(chalk.green('✅ Cleanup complete'))
  }
}

// Run the benchmark
if (require.main === module) {
  const benchmark = new FixedEnhancedBenchmark()
  benchmark.runBenchmark().catch(console.error)
}
#!/usr/bin/env node

import { MikroORM } from '@mikro-orm/core'
import { MySqlDriver } from '@mikro-orm/mysql'
import { PrismaClient } from '@prisma/client'
import { MySqlContainer } from '@testcontainers/mysql'
import chalk from 'chalk'
import { and, sql as drizzleSql, eq, gt } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import {
  Kysely,
  MysqlAdapter,
  MysqlDialect,
  MysqlIntrospector,
  MysqlQueryCompiler,
  sql
} from 'kysely'
import { createPool } from 'mysql2'
import mysql from 'mysql2/promise'
import kyselyExtension from 'prisma-extension-kysely'
import { Sequelize } from 'sequelize'
import { DataSource } from 'typeorm'
import { EnhancedBenchmarkReporter } from '../core/EnhancedReporter'
import * as schema from '../database/drizzle-schema'
import { BenchmarkResult } from '../types'
import 'reflect-metadata'
import knex, { Knex } from 'knex'
import { knexImplementations } from './knex-implementations'
import { mysql2PromiseImplementations } from './mysql2-promise-implementations'
import {
  mikroOrmImplementations,
  sequelizeImplementations,
  typeOrmImplementations
} from './new-orm-implementations'

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
  order_items: {
    id: number
    order_id: number
    product_id: number
    quantity: number
    price: number
  }
  reviews: {
    id: number
    user_id: number
    product_id: number
    rating: number
    comment: string | null
    created_at: Date
  }
}

// Global configuration
const BENCHMARK_DURATION = process.env.BENCHMARK_DURATION
  ? Number.parseInt(process.env.BENCHMARK_DURATION) * 1000
  : 5000 // Default 5 seconds per test
const WARMUP_DURATION = 1000 // 1 second warmup

export class ContainerizedBenchmarkRunner {
  private reporter = new EnhancedBenchmarkReporter()
  private mysqlContainer: any = null
  private mysql2Pool: mysql.Pool | null = null
  private mysql2PromisePool: mysql.Pool | null = null
  private knex: any = null
  private prismaClient: PrismaClient | null = null
  private kyselyDb: Kysely<Database> | null = null
  private drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null
  private prismaKyselyClient: any = null
  private typeormDataSource: DataSource | null = null
  private sequelize: Sequelize | null = null
  private mikroOrm: MikroORM<MySqlDriver> | null = null

  async runBenchmarks(): Promise<void> {
    console.log(
      chalk.bold.blue('🚀 Starting Database Driver Benchmark Suite\n')
    )

    this.reporter.printEnvironmentInfo()

    try {
      // Start MySQL container
      console.log(chalk.yellow('🐳 Starting MySQL container...'))
      this.mysqlContainer = await new MySqlContainer('mysql:8.0')
        .withDatabase('benchmark_db')
        .withUsername('benchmark_user')
        .withUserPassword('benchmark_pass')
        .withRootPassword('root_pass')
        .withExposedPorts(3306)
        .start()

      // Override environment for container
      process.env.DATABASE_URL = `mysql://benchmark_user:benchmark_pass@${this.mysqlContainer.getHost()}:${this.mysqlContainer.getMappedPort(3306)}/benchmark_db`

      console.log(chalk.green('✅ MySQL container started successfully'))
      console.log(chalk.grey(`📊 Connection: ${process.env.DATABASE_URL}`))

      // Setup database schema
      console.log(chalk.yellow('🏗️  Setting up database schema...'))
      await this.setupSchema()
      console.log(chalk.green('✅ Database schema ready'))

      // Run benchmark scenarios
      const results = await this.runAllScenarios()

      // Show simplified results
      this.printSimplifiedResults(results)

      // Export results
      this.reporter.exportToJson({
        name: 'Database Driver Performance Benchmark',
        description: 'Performance comparison using Docker containers',
        results,
        timestamp: new Date(),
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: require('node:os').cpus().length,
          memory: require('node:os').totalmem()
        }
      })
    } catch (error) {
      console.error(chalk.red('❌ Benchmark failed:'), error)
      process.exit(1)
    } finally {
      await this.cleanup()
    }
  }

  private async getMysql2Connection(): Promise<mysql.Pool> {
    if (!this.mysql2Pool) {
      this.mysql2Pool = mysql.createPool({
        host: this.mysqlContainer.getHost(),
        port: this.mysqlContainer.getMappedPort(3306),
        user: 'benchmark_user',
        password: 'benchmark_pass',
        database: 'benchmark_db',
        namedPlaceholders: true,
        connectionLimit: 10, // Same as other drivers
        waitForConnections: true,
        queueLimit: 0
      })
    }
    return this.mysql2Pool
  }

  private async getMysql2PromiseConnection(): Promise<mysql.Pool> {
    if (!this.mysql2PromisePool) {
      this.mysql2PromisePool = mysql.createPool({
        host: this.mysqlContainer.getHost(),
        port: this.mysqlContainer.getMappedPort(3306),
        user: 'benchmark_user',
        password: 'benchmark_pass',
        database: 'benchmark_db',
        namedPlaceholders: true,
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
        Promise: Promise // Use native Promise
      })
    }
    return this.mysql2PromisePool
  }

  private async getKnex(): Promise<Knex> {
    if (!this.knex) {
      this.knex = knex({
        client: 'mysql2',
        connection: {
          host: this.mysqlContainer.getHost(),
          port: this.mysqlContainer.getMappedPort(3306),
          user: 'benchmark_user',
          password: 'benchmark_pass',
          database: 'benchmark_db'
        },
        pool: {
          min: 2,
          max: 10
        }
      })
    }
    return this.knex
  }

  private async getPrismaClient(): Promise<PrismaClient> {
    if (!this.prismaClient) {
      this.prismaClient = new PrismaClient({
        log: ['error']
      })
      await this.prismaClient.$connect()
    }
    return this.prismaClient
  }

  private async getKyselyDb(): Promise<Kysely<Database>> {
    if (!this.kyselyDb) {
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

      this.kyselyDb = new Kysely<Database>({
        dialect
      })
    }
    return this.kyselyDb
  }

  private async getDrizzleDb(): Promise<
    ReturnType<typeof drizzle<typeof schema>>
  > {
    if (!this.drizzleDb) {
      const pool = createPool({
        host: this.mysqlContainer.getHost(),
        port: this.mysqlContainer.getMappedPort(3306),
        user: 'benchmark_user',
        password: 'benchmark_pass',
        database: 'benchmark_db',
        connectionLimit: 10
      })

      this.drizzleDb = drizzle(pool, { schema, mode: 'default' })
    }
    return this.drizzleDb
  }

  private async getPrismaKyselyClient(): Promise<any> {
    if (!this.prismaKyselyClient) {
      const basePrisma = new PrismaClient({
        log: ['error']
      })

      this.prismaKyselyClient = basePrisma.$extends(
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

      await this.prismaKyselyClient.$connect()
    }
    return this.prismaKyselyClient
  }

  private async getTypeOrmDataSource(): Promise<DataSource> {
    if (!this.typeormDataSource) {
      const { User, Product, Category, Order, OrderItem, Review } =
        await import('../database/typeorm-entities')

      this.typeormDataSource = new DataSource({
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

      await this.typeormDataSource.initialize()
    }
    return this.typeormDataSource
  }

  private async getSequelize(): Promise<Sequelize> {
    if (!this.sequelize) {
      this.sequelize = new Sequelize({
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

      const { initSequelizeModels } = await import(
        '../database/sequelize-models'
      )
      initSequelizeModels(this.sequelize)

      await this.sequelize.authenticate()
    }
    return this.sequelize
  }

  private async getMikroOrm(): Promise<MikroORM<MySqlDriver>> {
    if (!this.mikroOrm) {
      const { User, Product, Category, Order, OrderItem, Review } =
        await import('../database/mikro-orm-entities-fixed')
      const { defineConfig } = await import('@mikro-orm/mysql')

      const config = defineConfig({
        entities: [User, Product, Category, Order, OrderItem, Review],
        dbName: 'benchmark_db',
        host: this.mysqlContainer.getHost(),
        port: this.mysqlContainer.getMappedPort(3306),
        user: 'benchmark_user',
        password: 'benchmark_pass',
        pool: {
          min: 2,
          max: 10
        },
        debug: false,
        discovery: {
          disableDynamicFileAccess: true
        }
      })

      this.mikroOrm = await MikroORM.init<MySqlDriver>(config)
    }
    return this.mikroOrm
  }

  private async setupSchema(): Promise<void> {
    const conn = await this.getMysql2Connection()

    // Create tables
    await conn.execute(`
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
        
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_country (country),
        INDEX idx_age (age)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        
        INDEX idx_category (category_id),
        INDEX idx_price (price),
        INDEX idx_stock (stock_quantity),
        INDEX idx_active (is_active),
        INDEX idx_created_at (created_at)
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INT NULL,
        description TEXT,
        
        INDEX idx_parent (parent_id),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        shipping_address TEXT,
        
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_total (total_amount),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        
        INDEX idx_order (order_id),
        INDEX idx_product (product_id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user (user_id),
        INDEX idx_product (product_id),
        INDEX idx_rating (rating),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_product (user_id, product_id)
      )
    `)

    // Add sample data
    await this.seedMinimalData()
  }

  private async seedMinimalData(): Promise<void> {
    const conn = await this.getMysql2Connection()

    // Add some categories
    await conn.execute(`
      INSERT IGNORE INTO categories (id, name, description) VALUES
      (1, 'Electronics', 'Electronic devices'),
      (2, 'Books', 'Literature and books'),
      (3, 'Clothing', 'Apparel and fashion')
    `)

    // Add some users
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

    const userPlaceholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    await conn.execute(
      `
      INSERT IGNORE INTO users (email, first_name, last_name, status, age, country) 
      VALUES ${userPlaceholders}
    `,
      users.flat()
    )

    // Add some products
    const products = []
    for (let i = 1; i <= 1000; i++) {
      products.push([
        `Product ${i}`,
        `Description for product ${i}`,
        (Math.random() * 100).toFixed(2),
        Math.floor(Math.random() * 3) + 1,
        Math.floor(Math.random() * 100),
        true
      ])
    }

    const productPlaceholders = products
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ')
    await conn.execute(
      `
      INSERT IGNORE INTO products (name, description, price, category_id, stock_quantity, is_active) 
      VALUES ${productPlaceholders}
    `,
      products.flat()
    )

    // Add some orders
    const orders = []
    for (let i = 1; i <= 500; i++) {
      orders.push([
        Math.floor(Math.random() * 1000) + 1,
        'pending',
        (Math.random() * 200).toFixed(2),
        `Address ${i}, City, Country`
      ])
    }

    const orderPlaceholders = orders.map(() => '(?, ?, ?, ?)').join(', ')
    await conn.execute(
      `
      INSERT IGNORE INTO orders (user_id, status, total_amount, shipping_address) 
      VALUES ${orderPlaceholders}
    `,
      orders.flat()
    )
  }

  private async runTimedBenchmark(
    name: string,
    description: string,
    fn: () => Promise<void>
  ): Promise<BenchmarkResult & { p95Latency: number }> {
    const startTime = Date.now()
    const endTime = startTime + BENCHMARK_DURATION
    let iterations = 0
    const latencies: number[] = []

    // Warmup phase
    const warmupEnd = Date.now() + WARMUP_DURATION
    while (Date.now() < warmupEnd) {
      await fn()
    }

    // Run benchmark for specified duration
    while (Date.now() < endTime) {
      const iterStart = performance.now()
      await fn()
      const iterEnd = performance.now()
      latencies.push(iterEnd - iterStart)
      iterations++
    }

    const totalTime = latencies.reduce((a, b) => a + b, 0)
    const averageTime = totalTime / iterations
    const sortedLatencies = latencies.sort((a, b) => a - b)
    const minTime = sortedLatencies[0]
    const maxTime = sortedLatencies[sortedLatencies.length - 1]
    const p95Latency =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
    const operationsPerSecond = 1000 / averageTime

    return {
      name,
      description,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      p95Latency,
      iterations,
      operationsPerSecond,
      memoryUsage: {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      },
      timestamp: new Date().toISOString()
    }
  }

  private async runAllScenarios(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    const scenarios = [
      {
        name: 'Simple SELECT',
        description: 'Basic SELECT with LIMIT',
        mysql2: async () => {
          const conn = await this.getMysql2Connection()
          await conn.execute('SELECT * FROM users LIMIT 50')
        },
        mysql2Promise: async () => {
          const pool = await this.getMysql2PromiseConnection()
          await mysql2PromiseImplementations.simpleSelect(pool)
        },
        knex: async () => {
          const db = await this.getKnex()
          await knexImplementations.simpleSelect(db)
        },
        prisma: async () => {
          const prisma = await this.getPrismaClient()
          await prisma.user.findMany({ take: 50 })
        },
        kysely: async () => {
          const db = await this.getKyselyDb()
          await db.selectFrom('users').selectAll().limit(50).execute()
        },
        drizzle: async () => {
          const db = await this.getDrizzleDb()
          await db.select().from(schema.users).limit(50)
        },
        prismaKysely: async () => {
          const client = await this.getPrismaKyselyClient()
          await client.$kysely
            .selectFrom('users')
            .selectAll()
            .limit(50)
            .execute()
        },
        typeorm: async () => {
          const dataSource = await this.getTypeOrmDataSource()
          const { User } = await import('../database/typeorm-entities')
          await dataSource.getRepository(User).find({ take: 50 })
        },
        sequelize: async () => {
          const _sequelize = await this.getSequelize()
          const { User } = await import('../database/sequelize-models')
          await User.findAll({ limit: 50 })
        },
        mikroorm: async () => {
          const orm = await this.getMikroOrm()
          const { User } = await import('../database/mikro-orm-entities-fixed')
          const em = orm.em.fork()
          await em.find(User, {}, { limit: 50 })
        }
      },
      {
        name: 'Filtered SELECT',
        description: 'SELECT with WHERE conditions',
        mysql2: async () => {
          const conn = await this.getMysql2Connection()
          await conn.execute(
            'SELECT * FROM users WHERE status = ? AND age > ?',
            ['active', 25]
          )
        },
        mysql2Promise: async () => {
          const pool = await this.getMysql2PromiseConnection()
          await mysql2PromiseImplementations.filteredSelect(pool)
        },
        knex: async () => {
          const db = await this.getKnex()
          await knexImplementations.filteredSelect(db)
        },
        prisma: async () => {
          const prisma = await this.getPrismaClient()
          await prisma.user.findMany({
            where: { status: 'active', age: { gt: 25 } }
          })
        },
        kysely: async () => {
          const db = await this.getKyselyDb()
          await db
            .selectFrom('users')
            .selectAll()
            .where('status', '=', 'active')
            .where('age', '>', 25)
            .execute()
        },
        drizzle: async () => {
          const db = await this.getDrizzleDb()
          await db
            .select()
            .from(schema.users)
            .where(
              and(eq(schema.users.status, 'active'), gt(schema.users.age, 25))
            )
        },
        prismaKysely: async () => {
          const client = await this.getPrismaKyselyClient()
          await client.$kysely
            .selectFrom('users')
            .selectAll()
            .where('status', '=', 'active')
            .where('age', '>', 25)
            .execute()
        },
        typeorm: async () => {
          const dataSource = await this.getTypeOrmDataSource()
          await typeOrmImplementations.filteredSelect(dataSource)
        },
        sequelize: async () => {
          const _sequelize = await this.getSequelize()
          const { User } = await import('../database/sequelize-models')
          const { Op } = await import('sequelize')
          await User.findAll({
            where: {
              status: 'active',
              age: { [Op.gt]: 25 }
            }
          })
        },
        mikroorm: async () => {
          const orm = await this.getMikroOrm()
          const { User } = await import('../database/mikro-orm-entities-fixed')
          const em = orm.em.fork()
          await em.find(User, {
            status: 'active',
            age: { $gt: 25 }
          })
        }
      },
      {
        name: 'JOIN Query',
        description: 'Users with order aggregation',
        mysql2: async () => {
          const conn = await this.getMysql2Connection()
          await conn.execute(`
            SELECT u.id, u.email, u.first_name, u.last_name, 
                   COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.status = 'active'
            GROUP BY u.id
            LIMIT 30
          `)
        },
        mysql2Promise: async () => {
          const pool = await this.getMysql2PromiseConnection()
          await mysql2PromiseImplementations.joinQuery(pool)
        },
        knex: async () => {
          const db = await this.getKnex()
          await knexImplementations.joinQuery(db)
        },
        prisma: async () => {
          const prisma = await this.getPrismaClient()
          await prisma.user.findMany({
            where: { status: 'active' },
            include: { orders: { select: { id: true, totalAmount: true } } },
            take: 30
          })
        },
        kysely: async () => {
          const db = await this.getKyselyDb()
          await db
            .selectFrom('users as u')
            .leftJoin('orders as o', 'u.id', 'o.user_id')
            .select(['u.id', 'u.email', 'u.first_name', 'u.last_name'])
            .select(db.fn.count('o.id').as('order_count'))
            .select(
              sql<number>`COALESCE(SUM(o.total_amount), 0)`.as('total_spent')
            )
            .where('u.status', '=', 'active')
            .groupBy('u.id')
            .limit(30)
            .execute()
        },
        drizzle: async () => {
          const db = await this.getDrizzleDb()
          await db
            .select({
              id: schema.users.id,
              email: schema.users.email,
              firstName: schema.users.firstName,
              lastName: schema.users.lastName,
              orderCount: drizzleSql<number>`count(${schema.orders.id})`,
              totalSpent: drizzleSql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)`
            })
            .from(schema.users)
            .leftJoin(schema.orders, eq(schema.users.id, schema.orders.userId))
            .where(eq(schema.users.status, 'active'))
            .groupBy(schema.users.id)
            .limit(30)
        },
        prismaKysely: async () => {
          const client = await this.getPrismaKyselyClient()
          await client.$kysely
            .selectFrom('users as u')
            .leftJoin('orders as o', 'u.id', 'o.user_id')
            .select(['u.id', 'u.email', 'u.first_name', 'u.last_name'])
            .select(client.$kysely.fn.count('o.id').as('order_count'))
            .select(
              sql<number>`COALESCE(SUM(o.total_amount), 0)`.as('total_spent')
            )
            .where('u.status', '=', 'active')
            .groupBy('u.id')
            .limit(30)
            .execute()
        },
        typeorm: async () => {
          const dataSource = await this.getTypeOrmDataSource()
          await typeOrmImplementations.joinQuery(dataSource)
        },
        sequelize: async () => {
          const sequelize = await this.getSequelize()
          await sequelizeImplementations.joinQuery(sequelize)
        },
        mikroorm: async () => {
          const orm = await this.getMikroOrm()
          await mikroOrmImplementations.joinQuery(orm)
        }
      },
      {
        name: 'Complex JOIN',
        description: 'Products with categories and reviews',
        mysql2: async () => {
          const conn = await this.getMysql2Connection()
          await conn.execute(`
            SELECT p.id, p.name, p.price, c.name as category_name,
                   COUNT(r.id) as review_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.is_active = true
            GROUP BY p.id
            LIMIT 25
          `)
        },
        mysql2Promise: async () => {
          const pool = await this.getMysql2PromiseConnection()
          await mysql2PromiseImplementations.complexJoin(pool)
        },
        knex: async () => {
          const db = await this.getKnex()
          await knexImplementations.complexJoin(db)
        },
        prisma: async () => {
          const prisma = await this.getPrismaClient()
          await prisma.product.findMany({
            where: { isActive: true },
            include: {
              category: { select: { name: true } },
              reviews: { select: { id: true } }
            },
            take: 25
          })
        },
        kysely: async () => {
          const db = await this.getKyselyDb()
          await db
            .selectFrom('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('reviews as r', 'p.id', 'r.product_id')
            .select(['p.id', 'p.name', 'p.price'])
            .select('c.name as category_name')
            .select(db.fn.count('r.id').as('review_count'))
            .where('p.is_active', '=', true)
            .groupBy('p.id')
            .limit(25)
            .execute()
        },
        drizzle: async () => {
          const db = await this.getDrizzleDb()
          await db
            .select({
              id: schema.products.id,
              name: schema.products.name,
              price: schema.products.price,
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
        prismaKysely: async () => {
          const client = await this.getPrismaKyselyClient()
          await client.$kysely
            .selectFrom('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('reviews as r', 'p.id', 'r.product_id')
            .select(['p.id', 'p.name', 'p.price'])
            .select('c.name as category_name')
            .select(client.$kysely.fn.count('r.id').as('review_count'))
            .where('p.is_active', '=', true)
            .groupBy('p.id')
            .limit(25)
            .execute()
        },
        typeorm: async () => {
          const dataSource = await this.getTypeOrmDataSource()
          await typeOrmImplementations.complexJoin(dataSource)
        },
        sequelize: async () => {
          const sequelize = await this.getSequelize()
          await sequelizeImplementations.complexJoin(sequelize)
        },
        mikroorm: async () => {
          const orm = await this.getMikroOrm()
          await mikroOrmImplementations.complexJoin(orm)
        }
      },
      {
        name: 'INSERT Operation',
        description: 'Single record insertion',
        mysql2: async () => {
          const conn = await this.getMysql2Connection()
          const uniqueId = `${++this.insertCounter}_${Date.now()}`
          await conn.execute(
            'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
            [
              `mysql2_${uniqueId}@example.com`,
              'Test',
              'User',
              'active',
              30,
              'US'
            ]
          )
        },
        mysql2Promise: async () => {
          const pool = await this.getMysql2PromiseConnection()
          await mysql2PromiseImplementations.insert(pool, ++this.insertCounter)
        },
        knex: async () => {
          const db = await this.getKnex()
          await knexImplementations.insert(db, ++this.insertCounter)
        },
        prisma: async () => {
          const prisma = await this.getPrismaClient()
          const uniqueId = `${++this.insertCounter}_${Date.now()}`
          await prisma.user.create({
            data: {
              email: `prisma_${uniqueId}@example.com`,
              firstName: 'Test',
              lastName: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            }
          })
        },
        kysely: async () => {
          const db = await this.getKyselyDb()
          const uniqueId = `${++this.insertCounter}_${Date.now()}`
          await db
            .insertInto('users')
            .values({
              email: `kysely_${uniqueId}@example.com`,
              first_name: 'Test',
              last_name: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
            .execute()
        },
        drizzle: async () => {
          const db = await this.getDrizzleDb()
          const uniqueId = `${++this.insertCounter}_${Date.now()}`
          await db.insert(schema.users).values({
            email: `drizzle_${uniqueId}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            status: 'active',
            age: 30,
            country: 'US'
          })
        },
        prismaKysely: async () => {
          const client = await this.getPrismaKyselyClient()
          const uniqueId = `${++this.insertCounter}_${Date.now()}`
          await client.$kysely
            .insertInto('users')
            .values({
              email: `prismakysely_${uniqueId}@example.com`,
              first_name: 'Test',
              last_name: 'User',
              status: 'active',
              age: 30,
              country: 'US'
            })
            .execute()
        },
        typeorm: async () => {
          const dataSource = await this.getTypeOrmDataSource()
          await typeOrmImplementations.insert(dataSource, this.insertCounter++)
        },
        sequelize: async () => {
          const sequelize = await this.getSequelize()
          await sequelizeImplementations.insert(sequelize, this.insertCounter++)
        },
        mikroorm: async () => {
          const orm = await this.getMikroOrm()
          await mikroOrmImplementations.insert(orm, this.insertCounter++)
        }
      }
    ]

    console.log(
      chalk.yellow(
        `\n⏳ Running benchmarks... This will take approximately ${((scenarios.length * 10 * BENCHMARK_DURATION) / 1000 / 60).toFixed(1)} minutes\n`
      )
    )

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]
      console.log(
        chalk.cyan.bold(
          `\nScenario ${i + 1}/${scenarios.length}: ${scenario.name}`
        )
      )
      console.log(chalk.grey(`Description: ${scenario.description}\n`))

      // Run each driver sequentially to ensure isolation
      const drivers = [
        { name: 'MySQL2', fn: scenario.mysql2 },
        { name: 'MySQL2/Promise', fn: scenario.mysql2Promise },
        { name: 'Knex', fn: scenario.knex },
        { name: 'Prisma', fn: scenario.prisma },
        { name: 'Kysely', fn: scenario.kysely },
        { name: 'Drizzle', fn: scenario.drizzle },
        { name: 'Prisma+Kysely', fn: scenario.prismaKysely },
        { name: 'TypeORM', fn: scenario.typeorm },
        { name: 'Sequelize', fn: scenario.sequelize },
        { name: 'MikroORM', fn: scenario.mikroorm }
      ]

      for (const driver of drivers) {
        process.stdout.write(chalk.gray(`  Testing ${driver.name}... `))
        const result = await this.runTimedBenchmark(
          `${driver.name} - ${scenario.name}`,
          scenario.description,
          driver.fn
        )
        results.push(result)
        console.log(
          chalk.green(
            `✓ ${result.iterations} ops @ ${Math.round(result.operationsPerSecond)} ops/sec`
          )
        )
      }
    }
    return results
  }

  private printSimplifiedResults(results: any[]): void {
    // Calculate overall performance across all scenarios
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
    const driverStats = drivers
      .map(driver => {
        const driverResults = results.filter(r => r.name.startsWith(driver))
        const totalOps = driverResults.reduce((sum, r) => sum + r.iterations, 0)
        const totalTime = driverResults.reduce(
          (sum, r) => sum + r.iterations * r.averageTime,
          0
        )
        const avgLatency = totalTime / totalOps
        const avgOpsPerSec = 1000 / avgLatency
        const avgP95 =
          driverResults.reduce((sum, r) => sum + r.p95Latency, 0) /
          driverResults.length

        return {
          driver,
          avgOpsPerSec,
          avgLatency,
          avgP95,
          scenarioBreakdown: {
            'Simple SELECT':
              driverResults.find(r => r.name.includes('Simple SELECT'))
                ?.iterations || 0,
            'Filtered SELECT':
              driverResults.find(r => r.name.includes('Filtered SELECT'))
                ?.iterations || 0,
            'JOIN Query':
              driverResults.find(r => r.name.includes('JOIN Query'))
                ?.iterations || 0,
            'Complex JOIN':
              driverResults.find(r => r.name.includes('Complex JOIN'))
                ?.iterations || 0,
            'INSERT Operation':
              driverResults.find(r => r.name.includes('INSERT Operation'))
                ?.iterations || 0
          }
        }
      })
      .sort((a, b) => b.avgOpsPerSec - a.avgOpsPerSec)

    console.log(
      chalk.bold.blue('\n📊 Original Benchmark Results - Isolated Query Tests')
    )
    console.log(chalk.gray('─'.repeat(90)))

    console.log(
      'Driver'.padEnd(16) +
        'Ops/sec'.padStart(10) +
        'Latency'.padStart(10) +
        'P95'.padStart(8) +
        'Errors'.padStart(8) +
        'Status'
    )
    console.log(chalk.gray('─'.repeat(90)))

    const fastest = driverStats[0]?.avgOpsPerSec || 1

    driverStats.forEach((stat, index) => {
      const relative = Math.round((stat.avgOpsPerSec / fastest) * 100)
      let status = ''
      if (index === 0) {
        status = chalk.green(' ✨ FASTEST')
      } else {
        status = chalk.gray(` (${relative}%)`)
      }

      console.log(
        stat.driver.padEnd(16) +
          Math.round(stat.avgOpsPerSec).toString().padStart(10) +
          `${stat.avgLatency.toFixed(2)}ms`.padStart(10) +
          `${stat.avgP95.toFixed(2)}ms`.padStart(8) +
          '0'.padStart(8) +
          status
      )
    })

    // Scenario breakdown
    console.log(chalk.bold.blue('\n📈 Scenario Breakdown (Operations per 5s)'))
    console.log(chalk.gray('─'.repeat(90)))

    const scenarios = [
      'Simple SELECT',
      'Filtered SELECT',
      'JOIN Query',
      'Complex JOIN',
      'INSERT Operation'
    ]
    console.log(
      'Driver'.padEnd(16) +
        scenarios.map(s => s.substring(0, 10).padStart(10)).join('')
    )
    console.log(chalk.gray('─'.repeat(90)))

    driverStats.slice(0, 5).forEach(stat => {
      const counts = scenarios.map(scenario =>
        stat.scenarioBreakdown[scenario].toString().padStart(10)
      )
      console.log(stat.driver.padEnd(16) + counts.join(''))
    })

    console.log(chalk.bold.blue('\n🎯 Summary'))
    console.log(chalk.gray('─'.repeat(90)))
    console.log(
      `• Test methodology: Isolated query benchmarks (5 scenarios × ${BENCHMARK_DURATION / 1000}s each)`
    )
    console.log(`• Working drivers: ${drivers.length}/10`)
    console.log(`• Failed drivers: 0/10`)
    console.log(
      `• Test duration: ${BENCHMARK_DURATION / 1000}s per scenario per driver`
    )
    console.log(
      '\n' +
        chalk.yellow(
          '⚠️  Note: This benchmark tests each query type in isolation.'
        )
    )
    console.log(
      chalk.yellow('   For mixed workload results, use: pnpm benchmark')
    )
  }

  private async cleanup(): Promise<void> {
    console.log(chalk.yellow('🧹 Cleaning up resources...'))

    try {
      if (this.mysql2Pool) {
        await this.mysql2Pool.end()
        this.mysql2Pool = null
      }

      if (this.mysql2PromisePool) {
        await this.mysql2PromisePool.end()
        this.mysql2PromisePool = null
      }

      if (this.knex) {
        await this.knex.destroy()
        this.knex = null
      }

      if (this.prismaClient) {
        await this.prismaClient.$disconnect()
        this.prismaClient = null
      }

      if (this.kyselyDb) {
        await this.kyselyDb.destroy()
        this.kyselyDb = null
      }

      if (this.drizzleDb) {
        // Drizzle uses the mysql2 pool which will be closed when the pool is destroyed
        this.drizzleDb = null
      }

      if (this.prismaKyselyClient) {
        await this.prismaKyselyClient.$disconnect()
        this.prismaKyselyClient = null
      }

      if (this.typeormDataSource) {
        await this.typeormDataSource.destroy()
        this.typeormDataSource = null
      }

      if (this.sequelize) {
        await this.sequelize.close()
        this.sequelize = null
      }

      if (this.mikroOrm) {
        await this.mikroOrm.close()
        this.mikroOrm = null
      }

      if (this.mysqlContainer) {
        await this.mysqlContainer.stop()
      }

      console.log(chalk.green('✅ Cleanup completed'))
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error)
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new ContainerizedBenchmarkRunner()
  runner.runBenchmarks().catch(console.error)
}

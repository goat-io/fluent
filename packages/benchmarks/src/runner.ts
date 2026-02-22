#!/usr/bin/env node

import { program } from 'commander'
import { config } from 'dotenv'
import { MySQL2VsPrismaBenchmark } from './benchmarks/mysql2-vs-prisma'
import { DatabaseConnections } from './database/connections'
import { SeedData } from './setup/seedData'
import { DatabaseConfig } from './types'

// Load environment variables
config()

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'benchmark_db',
}

program
  .name('benchmark-runner')
  .description('Database benchmarking tool for MySQL2 vs Prisma')
  .version('1.0.0')

program
  .command('mysql2-vs-prisma')
  .description('Run MySQL2 vs Prisma benchmark suite')
  .option(
    '-i, --iterations <number>',
    'Number of iterations per benchmark',
    '1000',
  )
  .option('-w, --warmup <number>', 'Number of warmup runs', '100')
  .option('-c, --concurrency <number>', 'Concurrency level', '1')
  .action(async _options => {
    try {
      const benchmark = new MySQL2VsPrismaBenchmark(dbConfig)
      await benchmark.runBenchmarks()
    } catch (error) {
      console.error('❌ Benchmark failed:', error)
      process.exit(1)
    }
  })

program
  .command('seed')
  .description('Seed the database with test data')
  .option('-u, --users <number>', 'Number of users to create', '10000')
  .option('-p, --products <number>', 'Number of products to create', '10000')
  .option('-o, --orders <number>', 'Number of orders to create', '5000')
  .option('-r, --reviews <number>', 'Number of reviews to create', '3000')
  .action(async options => {
    try {
      const seeder = new SeedData(dbConfig)
      await seeder.seedDatabase(Number.parseInt(options.users))
      console.log('✅ Database seeded successfully')
    } catch (error) {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('test-connections')
  .description('Test database connections')
  .action(async () => {
    try {
      console.log('🔌 Testing database connections...')
      const connected = await DatabaseConnections.testConnections(dbConfig)
      if (connected) {
        console.log('✅ All connections successful')
      } else {
        console.log('❌ Connection failed')
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error)
      process.exit(1)
    } finally {
      await DatabaseConnections.closeConnections()
    }
  })

program
  .command('setup')
  .description('Setup database schema and seed data')
  .action(async () => {
    try {
      console.log('🚀 Setting up benchmark environment...')

      // First test connections
      console.log('🔌 Testing connections...')
      const connected = await DatabaseConnections.testConnections(dbConfig)
      if (!connected) {
        throw new Error('Failed to connect to database')
      }

      // Seed database
      console.log('🌱 Seeding database...')
      const seeder = new SeedData(dbConfig)
      await seeder.seedDatabase(10000)

      console.log('✅ Setup completed successfully!')
    } catch (error) {
      console.error('❌ Setup failed:', error)
      process.exit(1)
    } finally {
      await DatabaseConnections.closeConnections()
    }
  })

program.parse()

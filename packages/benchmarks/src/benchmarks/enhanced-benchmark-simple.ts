#!/usr/bin/env node
import chalk from 'chalk'
import * as mysql from 'mysql2'
import { GenericContainer } from 'testcontainers'
import { EnhancedBenchmarkRunner } from './enhanced-benchmark-runner'
import { DATA_DISTRIBUTIONS, OLTP_WORKLOAD } from './transaction-types'

async function runSimpleEnhancedBenchmark() {
  console.log(chalk.blue.bold('🚀 Running Simple Enhanced Benchmark Test'))
  console.log(
    chalk.gray('Testing transaction mix and think time patterns...\n')
  )

  // Start MySQL container
  console.log(chalk.yellow('Starting MySQL container...'))
  const container = await new GenericContainer('mysql:8.0')
    .withEnvironment({
      MYSQL_ROOT_PASSWORD: 'root',
      MYSQL_DATABASE: 'test',
      MYSQL_USER: 'test',
      MYSQL_PASSWORD: 'test'
    })
    .withExposedPorts(3306)
    .withStartupTimeout(60000)
    .start()

  console.log(chalk.green('✅ Container started'))

  try {
    // Create connection pool
    const pool = mysql.createPool({
      host: container.getHost(),
      port: container.getMappedPort(3306),
      user: 'test',
      password: 'test',
      database: 'test',
      waitForConnections: true,
      connectionLimit: 10
    })

    // Wait for MySQL to be ready
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Create simple test table
    console.log(chalk.yellow('Setting up test schema...'))
    await pool.promise().execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        status VARCHAR(20),
        age INT,
        country VARCHAR(2),
        INDEX idx_status_age (status, age)
      )
    `)

    // Seed test data
    console.log(chalk.yellow('Seeding test data...'))
    const seedData = []
    for (let i = 1; i <= 1000; i++) {
      seedData.push([
        `user${i}@test.com`,
        `First${i}`,
        `Last${i}`,
        i % 10 === 0 ? 'inactive' : 'active',
        20 + (i % 50),
        'US'
      ])
    }

    const placeholders = seedData.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    await pool
      .promise()
      .execute(
        `INSERT INTO users (email, first_name, last_name, status, age, country) VALUES ${placeholders}`,
        seedData.flat()
      )

    console.log(chalk.green('✅ Schema and data ready'))

    // Define transaction implementations
    const transactions: Record<string, () => Promise<void>> = {
      simpleSelect: async () => {
        const id = Math.floor(Math.random() * 1000) + 1
        await pool.promise().execute('SELECT * FROM users WHERE id = ?', [id])
      },
      filteredSelect: async () => {
        const age = 20 + Math.floor(Math.random() * 30)
        await pool
          .promise()
          .execute(
            'SELECT * FROM users WHERE status = ? AND age > ? LIMIT 50',
            ['active', age]
          )
      },
      joinQuery: async () => {
        // Simulate a join with self
        await pool.promise().execute(`
          SELECT u1.*, COUNT(u2.id) as related_count
          FROM users u1
          LEFT JOIN users u2 ON u1.country = u2.country AND u2.id != u1.id
          WHERE u1.status = 'active'
          GROUP BY u1.id
          LIMIT 20
        `)
      },
      complexJoin: async () => {
        // More complex aggregation
        await pool.promise().execute(`
          SELECT country, status, 
            COUNT(*) as user_count,
            AVG(age) as avg_age,
            MIN(age) as min_age,
            MAX(age) as max_age
          FROM users
          GROUP BY country, status
          ORDER BY user_count DESC
        `)
      },
      insert: async () => {
        const id = Date.now() + Math.floor(Math.random() * 1000000)
        await pool
          .promise()
          .execute(
            'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
            [`test${id}@example.com`, 'Test', 'User', 'active', 30, 'US']
          )
      }
    }

    // Run enhanced benchmark
    const runner = new EnhancedBenchmarkRunner()

    console.log(chalk.blue.bold('\n📊 Running Enhanced Benchmark'))
    console.log(
      chalk.gray('Testing OLTP workload with realistic patterns...\n')
    )

    const result = await runner.runBenchmark(
      OLTP_WORKLOAD,
      'MySQL2',
      async transactionName => {
        const fn = transactions[transactionName]
        if (!fn) {
          throw new Error(`Unknown transaction: ${transactionName}`)
        }
        await fn()
      },
      {
        warmupDuration: 2000,
        rampupDuration: 1000,
        measurementDuration: 5000,
        cooldownDuration: 1000,
        virtualUsers: 5,
        dataDistribution: DATA_DISTRIBUTIONS.uniform
      }
    )

    // Print results
    console.log(chalk.green.bold('\n✅ Benchmark Complete!\n'))

    console.log(chalk.cyan('Overall Performance:'))
    console.log(
      `  Throughput: ${chalk.bold(result.overall.throughput.toFixed(0))} ops/sec`
    )
    console.log(
      `  Avg Response Time: ${chalk.bold(result.overall.avgResponseTime.toFixed(2))}ms`
    )
    console.log(
      `  Total Operations: ${chalk.bold(result.overall.totalOperations)}`
    )
    console.log(
      `  Error Rate: ${chalk.bold(result.overall.errorRate.toFixed(2))}%`
    )

    console.log(chalk.cyan('\nTransaction Breakdown:'))
    result.transactions
      .sort((a, b) => b.count - a.count)
      .forEach(tx => {
        console.log(`\n  ${chalk.bold(tx.name)} (${tx.count} operations):`)
        console.log(`    Throughput: ${tx.throughput.toFixed(0)} ops/sec`)
        console.log(
          `    Latency - p50: ${tx.latency.p50.toFixed(1)}ms, p95: ${tx.latency.p95.toFixed(1)}ms, p99: ${tx.latency.p99.toFixed(1)}ms`
        )
        if (tx.errors > 0) {
          console.log(chalk.red(`    Errors: ${tx.errors}`))
        }
      })

    console.log(chalk.cyan('\nKey Insights:'))
    console.log('  ✓ Transaction mix follows OLTP pattern distribution')
    console.log('  ✓ Think time and pacing simulate realistic user behavior')
    console.log(
      '  ✓ Percentile latencies show tail performance characteristics'
    )
    console.log('  ✓ Warmup/rampup phases ensure stable measurements')

    // Cleanup
    await pool.end()
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  } finally {
    await container.stop()
    console.log(chalk.green('\n✅ Cleanup complete'))
  }
}

// Run the benchmark
runSimpleEnhancedBenchmark().catch(console.error)

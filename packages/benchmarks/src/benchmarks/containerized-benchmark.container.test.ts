import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ContainerizedConnections } from '../containers/ContainerizedConnections'
import { createBenchmarkRunner } from '../core/BenchmarkRunner'
import { EnhancedBenchmarkReporter } from '../core/EnhancedReporter'
import { BenchmarkResult } from '../types'

describe('MySQL2 vs Prisma Containerized Benchmarks', () => {
  const runner = createBenchmarkRunner()
  const reporter = new EnhancedBenchmarkReporter()

  beforeAll(async () => {
    // Setup database schema and seed data
    await ContainerizedConnections.setupSchema()
  })

  afterAll(async () => {
    await ContainerizedConnections.closeConnections()
  })

  it('should benchmark simple SELECT queries', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    // MySQL2 benchmark
    const mysql2Result = await runner.run(
      async () => {
        await mysql2Conn.execute('SELECT * FROM users LIMIT 50')
      },
      {
        name: 'MySQL2 - Simple SELECT',
        description: 'SELECT * FROM users LIMIT 50',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 1,
      }
    )

    // Prisma benchmark
    const prismaResult = await runner.run(
      async () => {
        await prisma.user.findMany({
          take: 50,
        })
      },
      {
        name: 'Prisma - Simple SELECT',
        description: 'findMany with take: 50',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 1,
      }
    )

    // Assert benchmarks completed successfully
    expect(mysql2Result.iterations).toBe(500)
    expect(prismaResult.iterations).toBe(500)
    expect(mysql2Result.operationsPerSecond).toBeGreaterThan(0)
    expect(prismaResult.operationsPerSecond).toBeGreaterThan(0)

    // Print quick comparison first
    reporter.printQuickComparison([mysql2Result, prismaResult])
    
    // Then detailed comparison
    reporter.printComparisonHeader('Simple SELECT Benchmark')
    reporter.compareResults([mysql2Result, prismaResult])
    reporter.printPerformanceInsights([mysql2Result, prismaResult])
  })

  it('should benchmark filtered SELECT queries', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    // MySQL2 benchmark
    const mysql2Result = await runner.run(
      async () => {
        await mysql2Conn.execute(
          'SELECT * FROM users WHERE status = ? AND age > ?',
          ['active', 25]
        )
      },
      {
        name: 'MySQL2 - Filtered SELECT',
        description: 'WHERE status = active AND age > 25',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 1,
      }
    )

    // Prisma benchmark
    const prismaResult = await runner.run(
      async () => {
        await prisma.user.findMany({
          where: {
            status: 'active',
            age: { gt: 25 },
          },
        })
      },
      {
        name: 'Prisma - Filtered SELECT',
        description: 'where: { status: active, age: { gt: 25 } }',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 1,
      }
    )

    expect(mysql2Result.iterations).toBe(500)
    expect(prismaResult.iterations).toBe(500)

    reporter.printComparisonHeader('Filtered SELECT Benchmark')
    reporter.compareResults([mysql2Result, prismaResult])
    reporter.printPerformanceInsights([mysql2Result, prismaResult])
  })

  it('should benchmark JOIN queries', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    // MySQL2 benchmark
    const mysql2Result = await runner.run(
      async () => {
        await mysql2Conn.execute(`
          SELECT u.id, u.email, u.first_name, u.last_name, 
                 COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE u.status = 'active'
          GROUP BY u.id
          LIMIT 50
        `)
      },
      {
        name: 'MySQL2 - JOIN Query',
        description: 'Users with order aggregation',
        iterations: 200,
        warmupRuns: 20,
        concurrency: 1,
      }
    )

    // Prisma benchmark
    const prismaResult = await runner.run(
      async () => {
        await prisma.user.findMany({
          where: { status: 'active' },
          include: {
            orders: {
              select: {
                id: true,
                totalAmount: true,
              },
            },
          },
          take: 50,
        })
      },
      {
        name: 'Prisma - JOIN Query',
        description: 'Users with orders include',
        iterations: 200,
        warmupRuns: 20,
        concurrency: 1,
      }
    )

    expect(mysql2Result.iterations).toBe(200)
    expect(prismaResult.iterations).toBe(200)

    reporter.printComparisonHeader('JOIN Query Benchmark')
    reporter.compareResults([mysql2Result, prismaResult])
    reporter.printPerformanceInsights([mysql2Result, prismaResult])
  })

  it('should benchmark INSERT operations', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    // MySQL2 benchmark
    const mysql2Result = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000000)
        await mysql2Conn.execute(
          'INSERT INTO users (email, first_name, last_name, status, age, country) VALUES (?, ?, ?, ?, ?, ?)',
          [`mysql2test${randomId}@example.com`, 'Test', 'User', 'active', 30, 'US']
        )
      },
      {
        name: 'MySQL2 - INSERT',
        description: 'Single user INSERT',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1,
      }
    )

    // Prisma benchmark
    const prismaResult = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000000)
        await prisma.user.create({
          data: {
            email: `prismatest${randomId}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            status: 'active',
            age: 30,
            country: 'US',
          },
        })
      },
      {
        name: 'Prisma - INSERT',
        description: 'Single user create',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1,
      }
    )

    expect(mysql2Result.iterations).toBe(100)
    expect(prismaResult.iterations).toBe(100)

    reporter.printComparisonHeader('INSERT Operation Benchmark')
    reporter.compareResults([mysql2Result, prismaResult])
    reporter.printPerformanceInsights([mysql2Result, prismaResult])
  })

  it('should benchmark UPDATE operations', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    // MySQL2 benchmark
    const mysql2Result = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000) + 1
        await mysql2Conn.execute(
          'UPDATE users SET age = ? WHERE id = ?',
          [Math.floor(Math.random() * 50) + 18, randomId]
        )
      },
      {
        name: 'MySQL2 - UPDATE',
        description: 'Single user UPDATE',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1,
      }
    )

    // Prisma benchmark
    const prismaResult = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000) + 1
        try {
          await prisma.user.update({
            where: { id: randomId },
            data: { age: Math.floor(Math.random() * 50) + 18 },
          })
        } catch (error) {
          // Ignore record not found errors in benchmark
        }
      },
      {
        name: 'Prisma - UPDATE',
        description: 'Single user update',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1,
      }
    )

    expect(mysql2Result.iterations).toBe(100)
    expect(prismaResult.iterations).toBe(100)

    reporter.printComparisonHeader('UPDATE Operation Benchmark')
    reporter.compareResults([mysql2Result, prismaResult])
    reporter.printPerformanceInsights([mysql2Result, prismaResult])
  })

  it('should generate comprehensive benchmark report', async () => {
    const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
    const prisma = await ContainerizedConnections.getPrismaClient()

    const benchmarks: BenchmarkResult[] = []

    // Run multiple benchmark scenarios
    const scenarios = [
      {
        name: 'Simple SELECT',
        mysql2: () => mysql2Conn.execute('SELECT * FROM users LIMIT 10'),
        prisma: () => prisma.user.findMany({ take: 10 }),
        iterations: 300,
      },
      {
        name: 'Filtered SELECT',
        mysql2: () => mysql2Conn.execute('SELECT * FROM users WHERE status = ?', ['active']),
        prisma: () => prisma.user.findMany({ where: { status: 'active' } }),
        iterations: 300,
      },
      {
        name: 'Complex JOIN',
        mysql2: () => mysql2Conn.execute(`
          SELECT p.id, p.name, p.price, c.name as category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.is_active = true
          LIMIT 20
        `),
        prisma: () => prisma.product.findMany({
          where: { isActive: true },
          include: { category: { select: { name: true } } },
          take: 20,
        }),
        iterations: 200,
      },
    ]

    for (const scenario of scenarios) {
      const mysql2Result = await runner.run(scenario.mysql2, {
        name: `MySQL2 - ${scenario.name}`,
        iterations: scenario.iterations,
        warmupRuns: Math.floor(scenario.iterations / 10),
        concurrency: 1,
      })

      const prismaResult = await runner.run(scenario.prisma, {
        name: `Prisma - ${scenario.name}`,
        iterations: scenario.iterations,
        warmupRuns: Math.floor(scenario.iterations / 10),
        concurrency: 1,
      })

      benchmarks.push(mysql2Result, prismaResult)
    }

    // Generate comprehensive report
    reporter.printComprehensiveReport(benchmarks)
    reporter.printSummaryStats(benchmarks)
    reporter.printRecommendations(benchmarks)

    expect(benchmarks.length).toBe(6) // 3 scenarios * 2 implementations
  })
})
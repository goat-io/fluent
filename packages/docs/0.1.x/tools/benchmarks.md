# Benchmarks Package

The `@goatlab/benchmarks` package provides comprehensive performance testing capabilities for database operations, with support for containerized testing environments and detailed performance analysis.

## Installation

```bash
npm install @goatlab/benchmarks
# or
pnpm add @goatlab/benchmarks
```

## Core Components

### BenchmarkRunner

The main class for running performance benchmarks on database operations.

```typescript
import { createBenchmarkRunner } from '@goatlab/benchmarks'

const runner = createBenchmarkRunner({
  iterations: 1000,
  warmupIterations: 100,
  timeoutMs: 30000,
  concurrency: 10
})
```

### BenchmarkReporter

Provides detailed reporting and analysis of benchmark results.

```typescript
import { BenchmarkReporter } from '@goatlab/benchmarks'

const reporter = new BenchmarkReporter()
```

### Enhanced Reporting

Advanced reporting with performance insights and recommendations.

```typescript
import { EnhancedBenchmarkReporter } from '@goatlab/benchmarks'

const enhancedReporter = new EnhancedBenchmarkReporter()
```

## Basic Usage

### Simple Benchmark

```typescript
import { createBenchmarkRunner, BenchmarkReporter } from '@goatlab/benchmarks'

const runner = createBenchmarkRunner({
  iterations: 1000,
  warmupIterations: 50
})

const reporter = new BenchmarkReporter()

// Benchmark a database operation
const result = await runner.benchmark('User Query', async () => {
  return await database.users.findMany()
})

// Generate report
reporter.printSummary(result)
```

### Compare Multiple Operations

```typescript
import { createBenchmarkRunner, BenchmarkReporter } from '@goatlab/benchmarks'

const runner = createBenchmarkRunner({
  iterations: 500,
  warmupIterations: 25
})

const reporter = new BenchmarkReporter()

// Benchmark multiple operations
const results = await Promise.all([
  runner.benchmark('MySQL2 Query', async () => {
    return await mysql2Connection.execute('SELECT * FROM users LIMIT 10')
  }),
  
  runner.benchmark('Prisma Query', async () => {
    return await prisma.user.findMany({ take: 10 })
  }),
  
  runner.benchmark('TypeORM Query', async () => {
    return await userRepository.find({ take: 10 })
  })
])

// Compare results
reporter.printComparisonHeader('Database ORM Comparison')
reporter.compareResults(results)
reporter.printPerformanceInsights(results)
```

## Database Connections

### MySQL2 Connection

```typescript
import { DatabaseConnections } from '@goatlab/benchmarks'

const mysql2Conn = await DatabaseConnections.getMysql2Connection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'benchmark_db'
})
```

### Prisma Connection

```typescript
const prisma = await DatabaseConnections.getPrismaClient({
  databaseUrl: 'mysql://root:password@localhost:3306/benchmark_db'
})
```

### TypeORM Connection

```typescript
const dataSource = await DatabaseConnections.getTypeORMConnection({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'benchmark_db'
})
```

## Containerized Testing

### Docker Container Setup

```typescript
import { ContainerizedConnections } from '@goatlab/benchmarks'

// Set up test environment with containers
const mysql2Conn = await ContainerizedConnections.getMysql2Connection()
const prisma = await ContainerizedConnections.getPrismaClient()

// Run benchmarks in containerized environment
const mysql2Result = await runner.benchmark('MySQL2 in Docker', async () => {
  const [rows] = await mysql2Conn.execute('SELECT * FROM users WHERE age > 25')
  return rows
})

const prismaResult = await runner.benchmark('Prisma in Docker', async () => {
  return await prisma.user.findMany({
    where: { age: { gt: 25 } }
  })
})
```

### Container Management

```typescript
import { ContainerizedBenchmarkRunner } from '@goatlab/benchmarks'

const containerRunner = new ContainerizedBenchmarkRunner({
  iterations: 1000,
  containers: ['mysql', 'postgres', 'redis'],
  cleanup: true
})

// Automatically manages container lifecycle
const results = await containerRunner.runBenchmarkSuite()
```

## Advanced Benchmarking

### Performance Profiling

```typescript
import { createBenchmarkRunner, EnhancedBenchmarkReporter } from '@goatlab/benchmarks'

const runner = createBenchmarkRunner({
  iterations: 1000,
  warmupIterations: 100,
  measureMemory: true,
  measureCPU: true
})

const reporter = new EnhancedBenchmarkReporter()

const result = await runner.benchmark('Complex Query', async () => {
  return await database.query(`
    SELECT u.*, p.title, COUNT(c.id) as comment_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON p.id = c.post_id
    GROUP BY u.id, p.id
    ORDER BY comment_count DESC
    LIMIT 50
  `)
})

// Detailed performance analysis
reporter.printDetailedAnalysis(result)
reporter.printMemoryUsage(result)
reporter.printCPUUsage(result)
```

### Concurrency Testing

```typescript
const runner = createBenchmarkRunner({
  iterations: 100,
  concurrency: 50, // 50 concurrent operations
  warmupIterations: 10
})

const result = await runner.benchmark('Concurrent User Queries', async () => {
  return await database.users.findUnique({
    where: { id: Math.floor(Math.random() * 1000) }
  })
})

reporter.printConcurrencyAnalysis(result)
```

### Load Testing

```typescript
const loadRunner = createBenchmarkRunner({
  iterations: 10000,
  concurrency: 100,
  duration: 60000, // 60 seconds
  rampUpTime: 10000 // 10 seconds ramp up
})

const loadResult = await loadRunner.benchmark('Load Test', async () => {
  // Simulate realistic user behavior
  const operations = [
    () => database.users.findMany({ take: 10 }),
    () => database.posts.findMany({ take: 20 }),
    () => database.comments.findMany({ take: 50 })
  ]
  
  const operation = operations[Math.floor(Math.random() * operations.length)]
  return await operation()
})

reporter.printLoadTestResults(loadResult)
```

## Data Seeding

### Seed Test Data

```typescript
import { SeedData } from '@goatlab/benchmarks'

const seeder = new SeedData()

// Seed database with test data
await seeder.seedUsers(10000)
await seeder.seedPosts(50000)
await seeder.seedComments(200000)

// Custom seeding
await seeder.seedCustomData('products', {
  count: 5000,
  factory: (index) => ({
    name: `Product ${index}`,
    price: Math.random() * 100,
    category: ['electronics', 'clothing', 'books'][Math.floor(Math.random() * 3)]
  })
})
```

### Data Cleanup

```typescript
// Clean up test data after benchmarks
await seeder.cleanup()

// Selective cleanup
await seeder.cleanupTable('users')
await seeder.cleanupTable('posts')
```

## Real-world Examples

### ORM Performance Comparison

```typescript
import { 
  createBenchmarkRunner, 
  BenchmarkReporter, 
  DatabaseConnections 
} from '@goatlab/benchmarks'

class ORMBenchmarkSuite {
  private runner: any
  private reporter: BenchmarkReporter
  
  constructor() {
    this.runner = createBenchmarkRunner({
      iterations: 1000,
      warmupIterations: 50,
      timeoutMs: 30000
    })
    this.reporter = new BenchmarkReporter()
  }
  
  async runSuite() {
    const mysql2Conn = await DatabaseConnections.getMysql2Connection()
    const prisma = await DatabaseConnections.getPrismaClient()
    const typeorm = await DatabaseConnections.getTypeORMConnection()
    
    console.log('🚀 Starting ORM Performance Benchmark Suite')
    
    // Simple SELECT queries
    const simpleResults = await this.benchmarkSimpleQueries(mysql2Conn, prisma, typeorm)
    
    // Complex JOIN queries
    const complexResults = await this.benchmarkComplexQueries(mysql2Conn, prisma, typeorm)
    
    // INSERT operations
    const insertResults = await this.benchmarkInsertOperations(mysql2Conn, prisma, typeorm)
    
    // Generate comprehensive report
    this.generateReport(simpleResults, complexResults, insertResults)
  }
  
  private async benchmarkSimpleQueries(mysql2Conn, prisma, typeorm) {
    return await Promise.all([
      this.runner.benchmark('MySQL2 Simple SELECT', async () => {
        const [rows] = await mysql2Conn.execute('SELECT * FROM users LIMIT 10')
        return rows
      }),
      
      this.runner.benchmark('Prisma Simple SELECT', async () => {
        return await prisma.user.findMany({ take: 10 })
      }),
      
      this.runner.benchmark('TypeORM Simple SELECT', async () => {
        return await typeorm.getRepository('User').find({ take: 10 })
      })
    ])
  }
  
  private async benchmarkComplexQueries(mysql2Conn, prisma, typeorm) {
    return await Promise.all([
      this.runner.benchmark('MySQL2 Complex JOIN', async () => {
        const [rows] = await mysql2Conn.execute(`
          SELECT u.*, COUNT(p.id) as post_count
          FROM users u
          LEFT JOIN posts p ON u.id = p.user_id
          GROUP BY u.id
          ORDER BY post_count DESC
          LIMIT 20
        `)
        return rows
      }),
      
      this.runner.benchmark('Prisma Complex JOIN', async () => {
        return await prisma.user.findMany({
          take: 20,
          include: {
            posts: true
          },
          orderBy: {
            posts: {
              _count: 'desc'
            }
          }
        })
      }),
      
      this.runner.benchmark('TypeORM Complex JOIN', async () => {
        return await typeorm.getRepository('User')
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.posts', 'post')
          .orderBy('COUNT(post.id)', 'DESC')
          .groupBy('user.id')
          .limit(20)
          .getMany()
      })
    ])
  }
  
  private generateReport(simpleResults, complexResults, insertResults) {
    this.reporter.printComparisonHeader('ORM Performance Comparison')
    
    console.log('\n📊 Simple SELECT Queries')
    this.reporter.compareResults(simpleResults)
    
    console.log('\n📊 Complex JOIN Queries')
    this.reporter.compareResults(complexResults)
    
    console.log('\n📊 INSERT Operations')
    this.reporter.compareResults(insertResults)
    
    console.log('\n🔍 Performance Insights')
    this.reporter.printPerformanceInsights([
      ...simpleResults,
      ...complexResults,
      ...insertResults
    ])
  }
}

// Run the benchmark suite
const suite = new ORMBenchmarkSuite()
await suite.runSuite()
```

### API Endpoint Benchmarking

```typescript
import { createBenchmarkRunner, BenchmarkReporter } from '@goatlab/benchmarks'

class APIBenchmarkSuite {
  private runner: any
  private reporter: BenchmarkReporter
  private baseUrl: string
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.runner = createBenchmarkRunner({
      iterations: 500,
      concurrency: 20,
      warmupIterations: 25
    })
    this.reporter = new BenchmarkReporter()
  }
  
  async benchmarkEndpoints() {
    const endpoints = [
      { path: '/api/users', method: 'GET', name: 'List Users' },
      { path: '/api/users/1', method: 'GET', name: 'Get User' },
      { path: '/api/posts', method: 'GET', name: 'List Posts' },
      { path: '/api/posts/1/comments', method: 'GET', name: 'Get Post Comments' }
    ]
    
    const results = await Promise.all(
      endpoints.map(endpoint => 
        this.runner.benchmark(endpoint.name, async () => {
          const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' }
          })
          return await response.json()
        })
      )
    )
    
    this.reporter.printComparisonHeader('API Endpoint Performance')
    this.reporter.compareResults(results)
    this.reporter.printPerformanceInsights(results)
    
    return results
  }
}
```

### Memory and CPU Profiling

```typescript
import { createBenchmarkRunner, EnhancedBenchmarkReporter } from '@goatlab/benchmarks'

class PerformanceProfiler {
  private runner: any
  private reporter: EnhancedBenchmarkReporter
  
  constructor() {
    this.runner = createBenchmarkRunner({
      iterations: 1000,
      warmupIterations: 50,
      measureMemory: true,
      measureCPU: true,
      measureGC: true
    })
    this.reporter = new EnhancedBenchmarkReporter()
  }
  
  async profileOperation(name: string, operation: () => Promise<any>) {
    const result = await this.runner.benchmark(name, operation)
    
    this.reporter.printDetailedAnalysis(result)
    this.reporter.printMemoryProfile(result)
    this.reporter.printCPUProfile(result)
    this.reporter.printGCProfile(result)
    
    return result
  }
  
  async profileMemoryLeaks() {
    const iterations = 10
    const results = []
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.runner.benchmark(`Memory Test ${i + 1}`, async () => {
        // Simulate memory-intensive operation
        const largeArray = new Array(100000).fill(0).map((_, index) => ({
          id: index,
          data: `Item ${index}`,
          timestamp: Date.now()
        }))
        
        return largeArray.filter(item => item.id % 2 === 0)
      })
      
      results.push(result)
      
      // Check for memory leaks
      if (i > 0) {
        const memoryDiff = result.memoryUsage.heapUsed - results[0].memoryUsage.heapUsed
        console.log(`Memory difference after ${i + 1} iterations: ${memoryDiff / 1024 / 1024} MB`)
      }
      
      // Force garbage collection
      if (global.gc) global.gc()
    }
    
    this.reporter.printMemoryLeakAnalysis(results)
  }
}
```

## Performance Visualization

### Chart Generation

```typescript
import { PerformanceChart } from '@goatlab/benchmarks'

const chart = new PerformanceChart()

// Generate performance charts
await chart.generateComparisonChart(results, {
  title: 'Database ORM Performance Comparison',
  outputPath: './benchmark-results.png',
  metrics: ['operationsPerSecond', 'averageTime', 'memoryUsage']
})

// Generate time series chart
await chart.generateTimeSeriesChart(timeSeriesData, {
  title: 'Performance Over Time',
  outputPath: './performance-timeline.png'
})
```

### HTML Report Generation

```typescript
import { BenchmarkReporter } from '@goatlab/benchmarks'

const reporter = new BenchmarkReporter()

// Generate HTML report
await reporter.generateHTMLReport(results, {
  title: 'Database Performance Benchmark Report',
  outputPath: './benchmark-report.html',
  includeCharts: true,
  includeRawData: true
})
```

## Configuration

### Benchmark Configuration

```typescript
const config = {
  iterations: 1000,
  warmupIterations: 100,
  timeoutMs: 30000,
  concurrency: 10,
  measureMemory: true,
  measureCPU: true,
  measureGC: true,
  outputFormat: 'json',
  outputPath: './benchmark-results.json'
}

const runner = createBenchmarkRunner(config)
```

### Environment Variables

```typescript
// .env file
BENCHMARK_ITERATIONS=1000
BENCHMARK_WARMUP_ITERATIONS=100
BENCHMARK_TIMEOUT_MS=30000
BENCHMARK_CONCURRENCY=10
BENCHMARK_OUTPUT_PATH=./results
DATABASE_URL=mysql://user:pass@localhost:3306/benchmark_db
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Benchmarks

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: benchmark_db
        ports:
          - 3306:3306
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run benchmarks
      run: npm run benchmark
    
    - name: Upload results
      uses: actions/upload-artifact@v2
      with:
        name: benchmark-results
        path: ./benchmark-results.json
```

### Performance Regression Detection

```typescript
import { createBenchmarkRunner, BenchmarkReporter } from '@goatlab/benchmarks'

class RegressionDetector {
  async detectRegressions(currentResults: any[], baselineResults: any[]) {
    const reporter = new BenchmarkReporter()
    
    const regressions = []
    
    for (const current of currentResults) {
      const baseline = baselineResults.find(b => b.name === current.name)
      if (!baseline) continue
      
      const performanceChange = (current.operationsPerSecond - baseline.operationsPerSecond) / baseline.operationsPerSecond
      
      if (performanceChange < -0.1) { // 10% regression threshold
        regressions.push({
          name: current.name,
          change: performanceChange,
          current: current.operationsPerSecond,
          baseline: baseline.operationsPerSecond
        })
      }
    }
    
    if (regressions.length > 0) {
      reporter.printRegressionReport(regressions)
      throw new Error(`Performance regression detected in ${regressions.length} benchmark(s)`)
    }
    
    return regressions
  }
}
```

## Best Practices

1. **Warm-up**: Always use warm-up iterations to avoid cold start effects
2. **Isolation**: Run benchmarks in isolated environments
3. **Consistency**: Use consistent test data and environments
4. **Multiple runs**: Run benchmarks multiple times and average results
5. **Resource monitoring**: Monitor CPU, memory, and I/O during benchmarks
6. **Baseline comparison**: Compare against established baselines
7. **CI integration**: Integrate with CI/CD for continuous performance monitoring

## Contributing

The benchmarks package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.
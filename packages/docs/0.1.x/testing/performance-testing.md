# Performance Testing

Performance testing in the Fluent ecosystem ensures that applications meet performance requirements under various load conditions. This guide covers performance testing strategies, tools, and best practices for comprehensive performance validation.

## Overview

Performance testing validates:
- **Response Time**: How quickly the system responds to requests
- **Throughput**: Number of requests handled per unit time
- **Resource Utilization**: CPU, memory, and network usage
- **Scalability**: System behavior under increasing load
- **Stability**: Performance consistency over time

## Performance Testing Types

### 1. Load Testing
Tests normal expected load conditions.

### 2. Stress Testing
Tests beyond normal capacity to find breaking points.

### 3. Spike Testing
Tests sudden load increases.

### 4. Volume Testing
Tests with large amounts of data.

### 5. Endurance Testing
Tests sustained load over extended periods.

## Benchmarking Framework

The Fluent ecosystem includes a comprehensive benchmarking framework, as seen in the `benchmarks` package:

```typescript
// benchmarks/src/core/BenchmarkRunner.ts
import { performance } from 'perf_hooks'

export interface BenchmarkOptions {
  name: string
  description?: string
  iterations: number
  warmupRuns?: number
  concurrency?: number
  timeout?: number
}

export interface BenchmarkResult {
  name: string
  description?: string
  iterations: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  operationsPerSecond: number
  standardDeviation: number
  memoryUsage: NodeJS.MemoryUsage
}

export class BenchmarkRunner {
  async run(
    operation: () => Promise<void> | void,
    options: BenchmarkOptions
  ): Promise<BenchmarkResult> {
    const { 
      name, 
      description, 
      iterations, 
      warmupRuns = 10, 
      concurrency = 1,
      timeout = 30000 
    } = options

    // Warmup phase
    console.log(`🔥 Warming up ${name}...`)
    for (let i = 0; i < warmupRuns; i++) {
      await operation()
    }

    // Main benchmark
    console.log(`📊 Running ${name} benchmark...`)
    const times: number[] = []
    const startMemory = process.memoryUsage()

    const startTime = performance.now()

    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now()
        await operation()
        const iterationEnd = performance.now()
        times.push(iterationEnd - iterationStart)
      }
    } else {
      // Concurrent execution
      const promises = []
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now()
        promises.push(
          operation().then(() => {
            const iterationEnd = performance.now()
            times.push(iterationEnd - iterationStart)
          })
        )
      }
      await Promise.all(promises)
    }

    const endTime = performance.now()
    const endMemory = process.memoryUsage()

    return this.calculateResults(
      name,
      description,
      iterations,
      times,
      startTime,
      endTime,
      startMemory,
      endMemory
    )
  }

  private calculateResults(
    name: string,
    description: string | undefined,
    iterations: number,
    times: number[],
    startTime: number,
    endTime: number,
    startMemory: NodeJS.MemoryUsage,
    endMemory: NodeJS.MemoryUsage
  ): BenchmarkResult {
    const totalTime = endTime - startTime
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const operationsPerSecond = (iterations / totalTime) * 1000

    // Calculate standard deviation
    const variance = times.reduce((sum, time) => {
      return sum + Math.pow(time - averageTime, 2)
    }, 0) / times.length
    const standardDeviation = Math.sqrt(variance)

    return {
      name,
      description,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      operationsPerSecond,
      standardDeviation,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      }
    }
  }
}
```

## Database Performance Testing

### Connection Pool Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TypeOrmConnector } from '@goatlab/fluent'
import { createBenchmarkRunner } from '../core/BenchmarkRunner'

describe('Database Performance', () => {
  let connector: TypeOrmConnector
  let runner: BenchmarkRunner

  beforeAll(async () => {
    connector = new TypeOrmConnector({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'benchmark_db',
      pool: {
        min: 10,
        max: 100,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      }
    })

    runner = new BenchmarkRunner()
  })

  it('should benchmark simple SELECT queries', async () => {
    const result = await runner.run(
      async () => {
        await connector.query('SELECT * FROM users LIMIT 50')
      },
      {
        name: 'Simple SELECT',
        description: 'SELECT * FROM users LIMIT 50',
        iterations: 1000,
        warmupRuns: 100,
        concurrency: 1
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(100)
    expect(result.averageTime).toBeLessThan(100) // Less than 100ms
  })

  it('should benchmark concurrent queries', async () => {
    const result = await runner.run(
      async () => {
        await connector.query('SELECT * FROM users WHERE status = $1', ['active'])
      },
      {
        name: 'Concurrent SELECT',
        description: 'Concurrent filtered SELECT queries',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 10
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(50)
    expect(result.averageTime).toBeLessThan(200)
  })

  it('should benchmark INSERT operations', async () => {
    const result = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000000)
        await connector.query(
          'INSERT INTO users (email, first_name, last_name) VALUES ($1, $2, $3)',
          [`test${randomId}@example.com`, 'Test', 'User']
        )
      },
      {
        name: 'INSERT Operations',
        description: 'Single row INSERT',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(10)
    expect(result.averageTime).toBeLessThan(500)
  })

  it('should benchmark bulk INSERT operations', async () => {
    const result = await runner.run(
      async () => {
        const values = Array.from({ length: 100 }, (_, i) => 
          `('bulk${Date.now()}_${i}@example.com', 'Bulk${i}', 'User')`
        ).join(', ')
        
        await connector.query(
          `INSERT INTO users (email, first_name, last_name) VALUES ${values}`
        )
      },
      {
        name: 'Bulk INSERT',
        description: '100 rows bulk INSERT',
        iterations: 10,
        warmupRuns: 2,
        concurrency: 1
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(1)
    expect(result.averageTime).toBeLessThan(5000)
  })

  it('should benchmark complex JOINs', async () => {
    const result = await runner.run(
      async () => {
        await connector.query(`
          SELECT u.id, u.email, u.first_name, u.last_name, 
                 COUNT(o.id) as order_count, 
                 COALESCE(SUM(o.total_amount), 0) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE u.status = 'active'
          GROUP BY u.id, u.email, u.first_name, u.last_name
          ORDER BY total_spent DESC
          LIMIT 100
        `)
      },
      {
        name: 'Complex JOIN',
        description: 'Users with order aggregation',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(5)
    expect(result.averageTime).toBeLessThan(1000)
  })
})
```

### Query Optimization Testing

```typescript
describe('Query Optimization', () => {
  it('should compare indexed vs non-indexed queries', async () => {
    // Test query without index
    const nonIndexedResult = await runner.run(
      async () => {
        await connector.query('SELECT * FROM users WHERE phone = $1', ['555-1234'])
      },
      {
        name: 'Non-indexed Query',
        iterations: 100,
        warmupRuns: 10
      }
    )

    // Create index
    await connector.query('CREATE INDEX idx_users_phone ON users(phone)')

    // Test query with index
    const indexedResult = await runner.run(
      async () => {
        await connector.query('SELECT * FROM users WHERE phone = $1', ['555-1234'])
      },
      {
        name: 'Indexed Query',
        iterations: 100,
        warmupRuns: 10
      }
    )

    // Indexed query should be faster
    expect(indexedResult.averageTime).toBeLessThan(nonIndexedResult.averageTime)
    expect(indexedResult.operationsPerSecond).toBeGreaterThan(nonIndexedResult.operationsPerSecond)

    // Cleanup
    await connector.query('DROP INDEX idx_users_phone')
  })
})
```

## API Performance Testing

### HTTP Load Testing

```typescript
import axios from 'axios'
import { describe, it, expect, beforeAll } from 'vitest'

describe('API Performance', () => {
  const baseURL = 'http://localhost:3000/api'
  let authToken: string

  beforeAll(async () => {
    // Get auth token for authenticated requests
    const response = await axios.post(`${baseURL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    })
    authToken = response.data.token
  })

  it('should handle high-volume GET requests', async () => {
    const runner = new BenchmarkRunner()

    const result = await runner.run(
      async () => {
        await axios.get(`${baseURL}/users`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      },
      {
        name: 'GET /users',
        description: 'List users endpoint',
        iterations: 500,
        warmupRuns: 50,
        concurrency: 10
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(50)
    expect(result.averageTime).toBeLessThan(200)
  })

  it('should handle concurrent POST requests', async () => {
    const runner = new BenchmarkRunner()

    const result = await runner.run(
      async () => {
        const randomId = Math.floor(Math.random() * 1000000)
        await axios.post(`${baseURL}/users`, {
          email: `load${randomId}@example.com`,
          firstName: 'Load',
          lastName: 'Test'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      },
      {
        name: 'POST /users',
        description: 'Create user endpoint',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 5
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(10)
    expect(result.averageTime).toBeLessThan(500)
  })

  it('should handle file upload performance', async () => {
    const runner = new BenchmarkRunner()
    const fileBuffer = Buffer.alloc(1024 * 1024) // 1MB file

    const result = await runner.run(
      async () => {
        const FormData = require('form-data')
        const form = new FormData()
        form.append('file', fileBuffer, 'test.txt')

        await axios.post(`${baseURL}/upload`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${authToken}`
          }
        })
      },
      {
        name: 'File Upload',
        description: '1MB file upload',
        iterations: 20,
        warmupRuns: 2,
        concurrency: 1
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(1)
    expect(result.averageTime).toBeLessThan(10000)
  })
})
```

### GraphQL Performance Testing

```typescript
describe('GraphQL Performance', () => {
  it('should handle complex GraphQL queries', async () => {
    const runner = new BenchmarkRunner()

    const query = `
      query GetUsersWithPosts {
        users(first: 50) {
          id
          email
          firstName
          lastName
          posts {
            id
            title
            content
            createdAt
          }
        }
      }
    `

    const result = await runner.run(
      async () => {
        await axios.post(`${baseURL}/graphql`, {
          query
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      },
      {
        name: 'Complex GraphQL Query',
        description: 'Users with posts query',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 5
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(5)
    expect(result.averageTime).toBeLessThan(1000)
  })

  it('should handle GraphQL mutations', async () => {
    const runner = new BenchmarkRunner()

    const mutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          id
          title
          content
        }
      }
    `

    const result = await runner.run(
      async () => {
        await axios.post(`${baseURL}/graphql`, {
          query: mutation,
          variables: {
            input: {
              title: `Performance Test ${Date.now()}`,
              content: 'This is a performance test post'
            }
          }
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      },
      {
        name: 'GraphQL Mutation',
        description: 'Create post mutation',
        iterations: 50,
        warmupRuns: 5,
        concurrency: 3
      }
    )

    expect(result.operationsPerSecond).toBeGreaterThan(3)
    expect(result.averageTime).toBeLessThan(500)
  })
})
```

## Memory and Resource Testing

### Memory Usage Testing

```typescript
describe('Memory Performance', () => {
  it('should monitor memory usage during operations', async () => {
    const runner = new BenchmarkRunner()

    const result = await runner.run(
      async () => {
        // Simulate memory-intensive operation
        const largeArray = new Array(100000).fill(0).map((_, i) => ({
          id: i,
          data: `test-data-${i}`,
          timestamp: Date.now()
        }))

        // Process the array
        largeArray.forEach(item => item.processed = true)

        // Clear reference
        largeArray.length = 0
      },
      {
        name: 'Memory Usage Test',
        description: 'Large array processing',
        iterations: 50,
        warmupRuns: 5,
        concurrency: 1
      }
    )

    expect(result.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    expect(result.operationsPerSecond).toBeGreaterThan(1)
  })

  it('should detect memory leaks', async () => {
    const initialMemory = process.memoryUsage()
    
    // Simulate potential memory leak
    const leakArray: any[] = []
    
    for (let i = 0; i < 1000; i++) {
      leakArray.push({
        id: i,
        data: new Array(1000).fill(`leak-${i}`)
      })
    }

    const afterLeakMemory = process.memoryUsage()
    
    // Clear the array
    leakArray.length = 0
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = process.memoryUsage()
    
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB increase
  })
})
```

### CPU Usage Testing

```typescript
describe('CPU Performance', () => {
  it('should monitor CPU usage during intensive operations', async () => {
    const runner = new BenchmarkRunner()

    const result = await runner.run(
      async () => {
        // CPU-intensive operation
        const iterations = 100000
        let sum = 0
        
        for (let i = 0; i < iterations; i++) {
          sum += Math.sqrt(i) * Math.sin(i)
        }
        
        return sum
      },
      {
        name: 'CPU Intensive Test',
        description: 'Mathematical calculations',
        iterations: 100,
        warmupRuns: 10,
        concurrency: 1
      }
    )

    expect(result.averageTime).toBeLessThan(100)
    expect(result.operationsPerSecond).toBeGreaterThan(10)
  })
})
```

## Load Testing with Artillery

### Artillery Configuration

```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Spike test"
  defaults:
    headers:
      Content-Type: 'application/json'
  variables:
    userEmail:
      - "user1@example.com"
      - "user2@example.com"
      - "user3@example.com"

scenarios:
  - name: "API Load Test"
    weight: 100
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "{{ userEmail }}"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/users"
          headers:
            Authorization: "Bearer {{ authToken }}"
      - post:
          url: "/api/posts"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            title: "Load Test Post {{ $randomString() }}"
            content: "This is a load test post"
      - get:
          url: "/api/posts"
          headers:
            Authorization: "Bearer {{ authToken }}"
```

### Running Artillery Tests

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run artillery.yml

# Run with custom target
artillery run --target http://staging.example.com artillery.yml

# Generate HTML report
artillery run --output report.json artillery.yml
artillery report report.json
```

## Performance Monitoring

### Application Performance Monitoring

```typescript
// monitoring/performanceMonitor.ts
import { performance } from 'perf_hooks'

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startTimer(name: string): () => void {
    const start = performance.now()
    
    return () => {
      const end = performance.now()
      const duration = end - start
      
      if (!this.metrics.has(name)) {
        this.metrics.set(name, [])
      }
      
      this.metrics.get(name)!.push(duration)
    }
  }

  getAverageTime(name: string): number {
    const times = this.metrics.get(name) || []
    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  getPercentile(name: string, percentile: number): number {
    const times = this.metrics.get(name) || []
    const sorted = times.sort((a, b) => a - b)
    const index = Math.floor(sorted.length * percentile / 100)
    return sorted[index] || 0
  }

  getMetricsReport(): Record<string, any> {
    const report: Record<string, any> = {}
    
    for (const [name, times] of this.metrics) {
      report[name] = {
        count: times.length,
        average: this.getAverageTime(name),
        min: Math.min(...times),
        max: Math.max(...times),
        p50: this.getPercentile(name, 50),
        p90: this.getPercentile(name, 90),
        p95: this.getPercentile(name, 95),
        p99: this.getPercentile(name, 99)
      }
    }
    
    return report
  }
}

// Usage in application
const monitor = new PerformanceMonitor()

// In your API routes
app.get('/api/users', async (req, res) => {
  const endTimer = monitor.startTimer('get_users')
  
  try {
    const users = await getUsersService()
    res.json(users)
  } finally {
    endTimer()
  }
})
```

### Database Performance Monitoring

```typescript
// monitoring/dbMonitor.ts
export class DatabaseMonitor {
  private queryTimes: Map<string, number[]> = new Map()
  private slowQueryThreshold: number = 100 // ms

  logQuery(query: string, duration: number): void {
    const queryType = this.getQueryType(query)
    
    if (!this.queryTimes.has(queryType)) {
      this.queryTimes.set(queryType, [])
    }
    
    this.queryTimes.get(queryType)!.push(duration)
    
    if (duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected: ${query} (${duration}ms)`)
    }
  }

  private getQueryType(query: string): string {
    const normalized = query.trim().toLowerCase()
    if (normalized.startsWith('select')) return 'SELECT'
    if (normalized.startsWith('insert')) return 'INSERT'
    if (normalized.startsWith('update')) return 'UPDATE'
    if (normalized.startsWith('delete')) return 'DELETE'
    return 'OTHER'
  }

  getSlowQueries(): Array<{ query: string; duration: number }> {
    // Implementation to return slow queries
    return []
  }

  getQueryStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    
    for (const [queryType, times] of this.queryTimes) {
      stats[queryType] = {
        count: times.length,
        average: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times)
      }
    }
    
    return stats
  }
}
```

## Continuous Performance Testing

### CI/CD Performance Pipeline

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_DB: perf_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: pnpm install
    
    - name: Build application
      run: pnpm build
    
    - name: Seed performance test data
      run: pnpm seed:performance
    
    - name: Run performance tests
      run: pnpm test:performance
    
    - name: Run load tests
      run: |
        npm install -g artillery
        artillery run tests/load/artillery.yml --output results.json
    
    - name: Generate performance report
      run: |
        artillery report results.json
        node scripts/generatePerformanceReport.js
    
    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: |
          results.json
          performance-report.html
    
    - name: Performance regression check
      run: node scripts/checkPerformanceRegression.js
```

### Performance Regression Detection

```typescript
// scripts/checkPerformanceRegression.ts
import { readFileSync } from 'fs'

interface PerformanceBaseline {
  [key: string]: {
    averageTime: number
    operationsPerSecond: number
    threshold: number
  }
}

const baseline: PerformanceBaseline = {
  'Simple SELECT': {
    averageTime: 50,
    operationsPerSecond: 100,
    threshold: 0.2 // 20% degradation threshold
  },
  'Complex JOIN': {
    averageTime: 200,
    operationsPerSecond: 20,
    threshold: 0.3 // 30% degradation threshold
  }
}

function checkPerformanceRegression(currentResults: any): void {
  const regressions: string[] = []
  
  for (const [testName, currentResult] of Object.entries(currentResults)) {
    const baselineData = baseline[testName]
    if (!baselineData) continue
    
    const avgTimeRegression = 
      (currentResult.averageTime - baselineData.averageTime) / baselineData.averageTime
    
    const opsRegression = 
      (baselineData.operationsPerSecond - currentResult.operationsPerSecond) / 
      baselineData.operationsPerSecond
    
    if (avgTimeRegression > baselineData.threshold) {
      regressions.push(
        `${testName}: Average time increased by ${(avgTimeRegression * 100).toFixed(1)}%`
      )
    }
    
    if (opsRegression > baselineData.threshold) {
      regressions.push(
        `${testName}: Operations per second decreased by ${(opsRegression * 100).toFixed(1)}%`
      )
    }
  }
  
  if (regressions.length > 0) {
    console.error('Performance regressions detected:')
    regressions.forEach(regression => console.error(`- ${regression}`))
    process.exit(1)
  } else {
    console.log('No performance regressions detected')
  }
}

// Load current results and check for regressions
const currentResults = JSON.parse(readFileSync('results.json', 'utf-8'))
checkPerformanceRegression(currentResults)
```

## Best Practices

### 1. Test Environment
- Use production-like environment
- Consistent hardware specifications
- Isolated test environment

### 2. Data Management
- Use realistic data volumes
- Consistent test data across runs
- Clean up test data after runs

### 3. Measurement
- Include warmup periods
- Run multiple iterations
- Account for system variability

### 4. Monitoring
- Monitor system resources
- Track performance over time
- Set performance budgets

### 5. Optimization
- Profile code to identify bottlenecks
- Optimize based on actual usage patterns
- Focus on user-perceived performance

### 6. Reporting
- Create clear performance reports
- Track trends over time
- Share results with stakeholders

This comprehensive performance testing guide ensures that the Fluent ecosystem maintains optimal performance under various load conditions and scales effectively with growth.
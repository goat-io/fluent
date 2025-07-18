# Performance Tuning Guide

This guide covers performance optimization strategies for Goat Fluent applications across different database connectors and usage patterns.

## Database Indexing

### SQL Database Indexes

```typescript
// entities/User.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity()
@Index(['email']) // Single column index
@Index(['lastName', 'firstName']) // Composite index
@Index(['createdAt', 'status']) // Query-specific index
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  @Index() // Unique index for frequent lookups
  email: string

  @Column()
  firstName: string

  @Column()
  lastName: string

  @Column()
  @Index() // Index for filtering
  status: 'active' | 'inactive' | 'pending'

  @Column({ type: 'timestamp' })
  @Index() // Index for date range queries
  createdAt: Date
}
```

### MongoDB Indexes

```typescript
// MongoDB index creation
import { MongoDataSource } from '../config/database'

const createMongoIndexes = async () => {
  const db = MongoDataSource.db
  
  // Single field indexes
  await db.collection('users').createIndex({ email: 1 })
  await db.collection('users').createIndex({ status: 1 })
  await db.collection('users').createIndex({ createdAt: 1 })
  
  // Compound indexes
  await db.collection('users').createIndex({ status: 1, createdAt: -1 })
  await db.collection('users').createIndex({ lastName: 1, firstName: 1 })
  
  // Text indexes for search
  await db.collection('users').createIndex({ 
    firstName: 'text', 
    lastName: 'text', 
    email: 'text' 
  })
  
  // Sparse indexes for optional fields
  await db.collection('users').createIndex({ 
    phoneNumber: 1 
  }, { sparse: true })
}
```

## Query Optimization

### Efficient Query Patterns

```typescript
// Good: Use specific field selection
const users = await userRepository.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true
  },
  where: { status: 'active' },
  limit: 50
})

// Bad: Select all fields
const users = await userRepository.findMany({
  where: { status: 'active' }
})

// Good: Use indexed fields in where clauses
const users = await userRepository.findMany({
  where: { 
    status: 'active', // indexed field
    createdAt: { gte: new Date('2023-01-01') } // indexed field
  }
})

// Good: Use pagination for large datasets
const users = await userRepository.findMany({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  limit: 20,
  offset: 0
})
```

### Batch Operations

```typescript
// utils/batchOperations.ts
export class BatchOperations {
  private repository: any
  private batchSize: number

  constructor(repository: any, batchSize: number = 1000) {
    this.repository = repository
    this.batchSize = batchSize
  }

  async batchInsert<T>(data: T[]): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize)
      const batchResults = await this.repository.insertMany(batch)
      results.push(...batchResults)
      
      // Optional: Add delay between batches to reduce load
      if (i + this.batchSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    return results
  }

  async batchUpdate<T>(
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < updates.length; i += this.batchSize) {
      const batch = updates.slice(i, i + this.batchSize)
      
      const batchPromises = batch.map(update => 
        this.repository.updateById(update.id, update.data)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }
}
```

## Connection Pool Optimization

### MySQL Connection Pool

```typescript
// config/optimizedMysql.ts
import { DataSource } from 'typeorm'

export const OptimizedMySQLDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  extra: {
    // Connection pool optimization
    connectionLimit: 20,          // Max connections
    acquireTimeout: 30000,        // 30 second timeout
    timeout: 60000,               // Query timeout
    reconnect: true,              // Auto-reconnect
    
    // Performance tuning
    dateStrings: false,           // Use Date objects
    supportBigNumbers: true,      // Handle large numbers
    bigNumberStrings: false,      // Return as numbers
    
    // Caching
    queryCache: true,            // Enable query caching
    
    // SSL optimization
    ssl: process.env.NODE_ENV === 'production' ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false
    } : false
  }
})
```

### PostgreSQL Connection Pool

```typescript
// config/optimizedPostgres.ts
import { DataSource } from 'typeorm'

export const OptimizedPostgreSQLDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  extra: {
    // Connection pool optimization
    max: 20,                      // Max connections
    min: 2,                       // Min connections
    connectionTimeoutMillis: 30000,  // Connection timeout
    idleTimeoutMillis: 30000,     // Idle timeout
    
    // Performance settings
    statement_timeout: 60000,     // Statement timeout
    query_timeout: 60000,         // Query timeout
    
    // Connection optimization
    application_name: 'goat-fluent',
    
    // SSL optimization
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  }
})
```

## Caching Strategies

### Query Result Caching

```typescript
// utils/queryCache.ts
import { Cache } from '@goatlab/js-utils'

export class QueryCache {
  private cache: Cache
  private defaultTTL: number

  constructor(defaultTTL: number = 300) { // 5 minutes
    this.cache = new Cache()
    this.defaultTTL = defaultTTL
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key)
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl || this.defaultTTL)
  }

  generateKey(operation: string, params: any): string {
    return `${operation}:${JSON.stringify(params)}`
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.deletePattern(pattern)
    } else {
      await this.cache.clear()
    }
  }
}

// Cached repository wrapper
export class CachedRepository<T, I, O> {
  private repository: any
  private cache: QueryCache

  constructor(repository: any, cache: QueryCache) {
    this.repository = repository
    this.cache = cache
  }

  async findMany(query: any, ttl?: number): Promise<O[]> {
    const cacheKey = this.cache.generateKey('findMany', query)
    
    // Try cache first
    const cached = await this.cache.get<O[]>(cacheKey)
    if (cached) {
      return cached
    }
    
    // Fetch from database
    const results = await this.repository.findMany(query)
    
    // Cache results
    await this.cache.set(cacheKey, results, ttl)
    
    return results
  }

  async findById(id: string, ttl?: number): Promise<O | null> {
    const cacheKey = this.cache.generateKey('findById', { id })
    
    const cached = await this.cache.get<O>(cacheKey)
    if (cached) {
      return cached
    }
    
    const result = await this.repository.findById(id)
    
    if (result) {
      await this.cache.set(cacheKey, result, ttl)
    }
    
    return result
  }

  async insert(data: I): Promise<O> {
    const result = await this.repository.insert(data)
    
    // Invalidate related caches
    await this.cache.clear('findMany:*')
    
    return result
  }

  async updateById(id: string, data: Partial<I>): Promise<O> {
    const result = await this.repository.updateById(id, data)
    
    // Invalidate specific caches
    await this.cache.clear(`findById:*${id}*`)
    await this.cache.clear('findMany:*')
    
    return result
  }
}
```

### Redis Caching

```typescript
// utils/redisCache.ts
import Redis from 'ioredis'

export class RedisCache {
  private redis: Redis
  private keyPrefix: string

  constructor(keyPrefix: string = 'goat-fluent:') {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })
    this.keyPrefix = keyPrefix
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(this.getKey(key))
    return value ? JSON.parse(value) : null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value)
    
    if (ttl) {
      await this.redis.setex(this.getKey(key), ttl, serialized)
    } else {
      await this.redis.set(this.getKey(key), serialized)
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key))
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(this.getKey(pattern))
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  async clear(): Promise<void> {
    await this.redis.flushdb()
  }
}
```

## Performance Monitoring

### Query Performance Monitoring

```typescript
// utils/performanceMonitor.ts
export class PerformanceMonitor {
  private metrics: Array<{
    operation: string
    duration: number
    timestamp: Date
    success: boolean
  }> = []

  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    let success = true
    
    try {
      const result = await fn()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = Date.now() - startTime
      
      this.metrics.push({
        operation,
        duration,
        timestamp: new Date(),
        success
      })
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${operation} took ${duration}ms`)
      }
    }
  }

  getMetrics(): typeof this.metrics {
    return this.metrics
  }

  getAverageResponseTime(operation?: string): number {
    const filteredMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics

    if (filteredMetrics.length === 0) return 0

    const totalDuration = filteredMetrics.reduce((sum, m) => sum + m.duration, 0)
    return totalDuration / filteredMetrics.length
  }

  getSlowQueries(threshold: number = 1000): typeof this.metrics {
    return this.metrics.filter(m => m.duration > threshold)
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

// Usage with repository
export class MonitoredRepository<T, I, O> {
  private repository: any
  private monitor: PerformanceMonitor

  constructor(repository: any, monitor: PerformanceMonitor) {
    this.repository = repository
    this.monitor = monitor
  }

  async findMany(query: any): Promise<O[]> {
    return this.monitor.measureOperation(
      'findMany',
      () => this.repository.findMany(query)
    )
  }

  async findById(id: string): Promise<O | null> {
    return this.monitor.measureOperation(
      'findById',
      () => this.repository.findById(id)
    )
  }

  async insert(data: I): Promise<O> {
    return this.monitor.measureOperation(
      'insert',
      () => this.repository.insert(data)
    )
  }
}
```

## Memory Optimization

### Memory-Efficient Data Processing

```typescript
// utils/memoryOptimization.ts
export class MemoryOptimizedProcessor {
  private processedCount = 0
  private batchSize: number

  constructor(batchSize: number = 1000) {
    this.batchSize = batchSize
  }

  async processLargeDataset<T, R>(
    repository: any,
    processor: (batch: T[]) => Promise<R[]>,
    query: any = {}
  ): Promise<R[]> {
    const results: R[] = []
    let offset = 0
    
    // Force garbage collection periodically
    const gcInterval = 5000 // Every 5000 records
    
    while (true) {
      // Fetch batch
      const batch = await repository.findMany({
        ...query,
        limit: this.batchSize,
        offset
      })
      
      if (batch.length === 0) break
      
      // Process batch
      const batchResults = await processor(batch)
      results.push(...batchResults)
      
      this.processedCount += batch.length
      offset += this.batchSize
      
      // Force garbage collection periodically
      if (this.processedCount % gcInterval === 0) {
        if (global.gc) {
          global.gc()
        }
      }
      
      // Optional: Add small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 1))
    }
    
    return results
  }

  getProcessedCount(): number {
    return this.processedCount
  }

  reset(): void {
    this.processedCount = 0
  }
}
```

## Connector-Specific Optimizations

### Firebase Optimization

```typescript
// config/optimizedFirebase.ts
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize with optimized settings
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
})

const firestore = getFirestore(firebaseApp)

// Configure Firestore settings
firestore.settings({
  // Increase timeout for large operations
  databaseId: 'default',
  ignoreUndefinedProperties: true,
  
  // Connection optimization
  ssl: true,
  
  // Caching
  cacheSizeBytes: 100 * 1024 * 1024, // 100MB cache
})

// Optimized batch operations
export class OptimizedFirebaseOperations {
  private firestore: FirebaseFirestore.Firestore
  private batchSize: number

  constructor(firestore: FirebaseFirestore.Firestore, batchSize: number = 500) {
    this.firestore = firestore
    this.batchSize = batchSize
  }

  async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete'
    collection: string
    docId: string
    data?: any
  }>): Promise<void> {
    for (let i = 0; i < operations.length; i += this.batchSize) {
      const batch = this.firestore.batch()
      const batchOps = operations.slice(i, i + this.batchSize)
      
      for (const op of batchOps) {
        const docRef = this.firestore.collection(op.collection).doc(op.docId)
        
        switch (op.type) {
          case 'set':
            batch.set(docRef, op.data)
            break
          case 'update':
            batch.update(docRef, op.data)
            break
          case 'delete':
            batch.delete(docRef)
            break
        }
      }
      
      await batch.commit()
    }
  }
}
```

### MongoDB Optimization

```typescript
// config/optimizedMongo.ts
import { MongoClient } from 'mongodb'

export class OptimizedMongoOperations {
  private client: MongoClient
  private database: string

  constructor(client: MongoClient, database: string) {
    this.client = client
    this.database = database
  }

  async aggregateWithCursor<T>(
    collection: string,
    pipeline: any[],
    options: { batchSize?: number } = {}
  ): Promise<T[]> {
    const db = this.client.db(this.database)
    const cursor = db.collection(collection).aggregate(pipeline, {
      batchSize: options.batchSize || 1000,
      allowDiskUse: true // Allow disk usage for large aggregations
    })
    
    const results: T[] = []
    
    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (doc) {
        results.push(doc as T)
      }
    }
    
    return results
  }

  async bulkWrite(
    collection: string,
    operations: any[],
    options: { ordered?: boolean } = {}
  ): Promise<any> {
    const db = this.client.db(this.database)
    
    return db.collection(collection).bulkWrite(operations, {
      ordered: options.ordered || false, // Parallel execution
      writeConcern: { w: 1 } // Acknowledgment from primary only
    })
  }
}
```

## Load Testing and Benchmarking

### Performance Testing

```typescript
// test/performance.test.ts
import { PerformanceMonitor } from '../utils/performanceMonitor'
import { UserRepository } from '../repositories/UserRepository'

describe('Performance Tests', () => {
  let userRepository: UserRepository
  let monitor: PerformanceMonitor

  beforeEach(() => {
    userRepository = new UserRepository()
    monitor = new PerformanceMonitor()
  })

  it('should handle concurrent reads efficiently', async () => {
    const concurrentReads = 100
    const promises = Array.from({ length: concurrentReads }, (_, i) =>
      monitor.measureOperation(
        `concurrent-read-${i}`,
        () => userRepository.findMany({ limit: 10 })
      )
    )

    const results = await Promise.all(promises)
    const avgResponseTime = monitor.getAverageResponseTime()

    expect(avgResponseTime).toBeLessThan(1000) // Should be under 1 second
    expect(results).toHaveLength(concurrentReads)
  })

  it('should handle batch inserts efficiently', async () => {
    const batchSize = 1000
    const testData = Array.from({ length: batchSize }, (_, i) => ({
      email: `user${i}@test.com`,
      name: `User ${i}`
    }))

    const startTime = Date.now()
    await userRepository.insertMany(testData)
    const duration = Date.now() - startTime

    const recordsPerSecond = batchSize / (duration / 1000)
    expect(recordsPerSecond).toBeGreaterThan(100) // Should process > 100 records/second
  })
})
```

## Best Practices Summary

### Query Optimization
- Use specific field selection with `select`
- Add indexes on frequently queried fields
- Use pagination for large result sets
- Implement query caching for repeated queries
- Monitor slow queries and optimize them

### Connection Management
- Configure appropriate connection pool sizes
- Use connection pooling for production
- Implement connection retry logic
- Monitor connection pool utilization

### Memory Management
- Process large datasets in batches
- Use streaming for very large operations
- Implement garbage collection triggers
- Monitor memory usage and optimize accordingly

### Caching Strategy
- Cache frequently accessed data
- Use appropriate TTL values
- Implement cache invalidation strategies
- Consider distributed caching for scale

### Monitoring and Alerting
- Monitor query performance metrics
- Set up alerts for slow queries
- Track error rates and response times
- Implement health checks for databases

This comprehensive performance tuning guide provides the tools and strategies needed to optimize Goat Fluent applications for maximum performance and scalability.
# Node Backend Package

The `@goatlab/node-backend` package provides backend utilities focused on caching and performance optimization. It features a high-performance caching system with LRU memory caching and Redis support.

## Installation

```bash
npm install @goatlab/node-backend
# or
pnpm add @goatlab/node-backend
```

## Core Features

### Cache

A high-performance caching system that supports both in-memory LRU caching and Redis backends.

```typescript
import { Cache } from '@goatlab/node-backend'

// Create cache instance
const cache = new Cache({
  connection: undefined, // In-memory cache
  opts: {
    namespace: 'my-app',
    usesLRUMemory: true
  }
})

// With Redis
const redisCache = new Cache({
  connection: 'redis://localhost:6379',
  opts: {
    namespace: 'my-app',
    usesLRUMemory: true
  }
})
```

## Basic Usage

### Simple Caching

```typescript
import { Cache } from '@goatlab/node-backend'

const cache = new Cache({
  connection: undefined,
  opts: { namespace: 'app' }
})

// Set value
await cache.set('user:123', { name: 'John', email: 'john@example.com' })

// Get value
const user = await cache.get('user:123')
console.log(user) // { name: 'John', email: 'john@example.com' }

// Check if key exists
const exists = await cache.has('user:123') // true

// Delete key
await cache.delete('user:123')
```

### TTL (Time To Live)

```typescript
// Set with TTL (5 minutes)
await cache.set('session:abc123', { userId: '123' }, 5 * 60 * 1000)

// Set with custom TTL
await cache.set('temp:data', { value: 'temporary' }, 30000) // 30 seconds

// Get with automatic expiration
const session = await cache.get('session:abc123')
```

## Advanced Caching Patterns

### Remember Pattern

Cache data with automatic population on miss:

```typescript
import { Cache } from '@goatlab/node-backend'

const cache = new Cache({
  connection: undefined,
  opts: { namespace: 'users' }
})

// Remember pattern - fetch from database if not cached
const user = await cache.remember(
  'user:123',
  60000, // 1 minute TTL
  async () => {
    // This function is called only if key doesn't exist
    return await database.findUser(123)
  }
)

// Remember forever (no TTL)
const config = await cache.rememberForever(
  'app:config',
  async () => {
    return await loadConfigFromFile()
  }
)
```

### Pull Pattern

Retrieve and remove data in one operation:

```typescript
// Store temporary data
await cache.set('reset-token:abc123', { userId: '123', expires: Date.now() + 3600000 })

// Pull data (get and delete)
const token = await cache.pull('reset-token:abc123')
console.log(token) // { userId: '123', expires: ... }

// Subsequent calls return null
const token2 = await cache.pull('reset-token:abc123') // null
```

### Batch Operations

```typescript
// Set multiple keys
await Promise.all([
  cache.set('user:1', { name: 'John' }),
  cache.set('user:2', { name: 'Jane' }),
  cache.set('user:3', { name: 'Bob' })
])

// Get multiple keys
const users = await Promise.all([
  cache.get('user:1'),
  cache.get('user:2'),
  cache.get('user:3')
])
```

## Redis Integration

### Redis Configuration

```typescript
import { Cache } from '@goatlab/node-backend'

// Basic Redis connection
const redisCache = new Cache({
  connection: 'redis://localhost:6379',
  opts: {
    namespace: 'my-app',
    usesLRUMemory: true // Enable dual-layer caching
  }
})

// Redis with authentication
const authRedisCache = new Cache({
  connection: 'redis://username:password@localhost:6379/0',
  opts: {
    namespace: 'my-app'
  }
})

// Redis cluster
const clusterCache = new Cache({
  connection: 'redis://node1:6379,redis://node2:6379,redis://node3:6379',
  opts: {
    namespace: 'my-app'
  }
})
```

### Dual-Layer Caching

Combine in-memory LRU cache with Redis for optimal performance:

```typescript
const cache = new Cache({
  connection: 'redis://localhost:6379',
  opts: {
    namespace: 'my-app',
    usesLRUMemory: true // Enable LRU memory cache
  }
})

// This will:
// 1. Check LRU memory cache first
// 2. If not found, check Redis
// 3. If found in Redis, cache in LRU memory for future hits
const data = await cache.get('frequently-accessed-key')
```

## Advanced Features

### Pattern-Based Operations

```typescript
// Delete all keys starting with pattern
await cache.deleteWhereStartsWith('user:')

// Get all values where key starts with pattern
const userSessions = await cache.getValueWhereKeyStartsWith('session:user:')
```

### Cache Invalidation

```typescript
// Clear specific keys
await cache.forget('user:123')

// Clear all keys in namespace
await cache.flush()

// Clear by pattern
await cache.deleteWhereStartsWith('temp:')
```

### Custom Validation

The cache automatically validates data to avoid storing empty values:

```typescript
// These will NOT be cached
await cache.set('empty-string', '') // Not cached
await cache.set('null-value', null) // Not cached
await cache.set('undefined-value', undefined) // Not cached
await cache.set('empty-array', []) // Not cached
await cache.set('empty-object', {}) // Not cached

// These WILL be cached
await cache.set('valid-string', 'hello') // Cached
await cache.set('valid-number', 42) // Cached
await cache.set('valid-array', [1, 2, 3]) // Cached
await cache.set('valid-object', { key: 'value' }) // Cached
```

## Real-world Examples

### User Session Management

```typescript
import { Cache } from '@goatlab/node-backend'

class SessionManager {
  private cache: Cache<any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'sessions',
        usesLRUMemory: true
      }
    })
  }
  
  async createSession(userId: string, sessionData: any) {
    const sessionId = this.generateSessionId()
    const sessionKey = `session:${sessionId}`
    
    await this.cache.set(sessionKey, {
      userId,
      ...sessionData,
      createdAt: new Date().toISOString()
    }, 24 * 60 * 60 * 1000) // 24 hours
    
    return sessionId
  }
  
  async getSession(sessionId: string) {
    return await this.cache.get(`session:${sessionId}`)
  }
  
  async refreshSession(sessionId: string) {
    const session = await this.cache.get(`session:${sessionId}`)
    if (session) {
      await this.cache.set(`session:${sessionId}`, session, 24 * 60 * 60 * 1000)
    }
    return session
  }
  
  async destroySession(sessionId: string) {
    await this.cache.forget(`session:${sessionId}`)
  }
  
  async destroyUserSessions(userId: string) {
    const sessions = await this.cache.getValueWhereKeyStartsWith(`session:`)
    for (const session of sessions) {
      if (session.userId === userId) {
        await this.cache.deleteWhereStartsWith(`session:${session.id}`)
      }
    }
  }
  
  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}
```

### API Response Caching

```typescript
import { Cache } from '@goatlab/node-backend'

class ApiCache {
  private cache: Cache<any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'api-cache',
        usesLRUMemory: true
      }
    })
  }
  
  async cacheApiResponse(endpoint: string, params: any, response: any, ttl: number = 300000) {
    const cacheKey = this.buildCacheKey(endpoint, params)
    await this.cache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
      endpoint,
      params
    }, ttl)
  }
  
  async getCachedResponse(endpoint: string, params: any) {
    const cacheKey = this.buildCacheKey(endpoint, params)
    return await this.cache.get(cacheKey)
  }
  
  async invalidateEndpoint(endpoint: string) {
    await this.cache.deleteWhereStartsWith(endpoint)
  }
  
  private buildCacheKey(endpoint: string, params: any): string {
    const paramString = JSON.stringify(params)
    const hash = require('crypto').createHash('md5').update(paramString).digest('hex')
    return `${endpoint}:${hash}`
  }
}

// Usage in Express middleware
app.use('/api', async (req, res, next) => {
  const apiCache = new ApiCache()
  const cacheKey = req.path
  const params = { ...req.query, ...req.body }
  
  const cached = await apiCache.getCachedResponse(cacheKey, params)
  if (cached) {
    return res.json(cached.data)
  }
  
  // Store original res.json
  const originalJson = res.json
  res.json = function(data) {
    // Cache the response
    apiCache.cacheApiResponse(cacheKey, params, data, 300000) // 5 minutes
    return originalJson.call(this, data)
  }
  
  next()
})
```

### Database Query Caching

```typescript
import { Cache } from '@goatlab/node-backend'

class DatabaseCache {
  private cache: Cache<any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'db-cache',
        usesLRUMemory: true
      }
    })
  }
  
  async findUser(id: string) {
    return await this.cache.remember(
      `user:${id}`,
      600000, // 10 minutes
      async () => {
        console.log(`Fetching user ${id} from database`)
        return await database.users.findById(id)
      }
    )
  }
  
  async findUserPosts(userId: string, page: number = 1) {
    return await this.cache.remember(
      `user:${userId}:posts:${page}`,
      300000, // 5 minutes
      async () => {
        console.log(`Fetching posts for user ${userId}, page ${page}`)
        return await database.posts.findByUserId(userId, page)
      }
    )
  }
  
  async invalidateUser(id: string) {
    await this.cache.forget(`user:${id}`)
    await this.cache.deleteWhereStartsWith(`user:${id}:`)
  }
  
  async getOrCreateCounter(key: string) {
    const counter = await this.cache.get(`counter:${key}`)
    if (counter !== null) {
      return counter
    }
    
    await this.cache.set(`counter:${key}`, 0)
    return 0
  }
  
  async incrementCounter(key: string) {
    const current = await this.getOrCreateCounter(key)
    const newValue = current + 1
    await this.cache.set(`counter:${key}`, newValue)
    return newValue
  }
}
```

### Rate Limiting

```typescript
import { Cache } from '@goatlab/node-backend'

class RateLimiter {
  private cache: Cache<any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'rate-limit'
      }
    })
  }
  
  async checkLimit(identifier: string, windowMs: number, maxRequests: number) {
    const key = `${identifier}:${Math.floor(Date.now() / windowMs)}`
    
    const current = await this.cache.get(key) || 0
    
    if (current >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.ceil(Date.now() / windowMs) * windowMs
      }
    }
    
    await this.cache.set(key, current + 1, windowMs)
    
    return {
      allowed: true,
      remaining: maxRequests - current - 1,
      resetTime: Math.ceil(Date.now() / windowMs) * windowMs
    }
  }
}

// Express middleware
const rateLimiter = new RateLimiter()

app.use('/api', async (req, res, next) => {
  const identifier = req.ip
  const result = await rateLimiter.checkLimit(identifier, 60000, 100) // 100 requests per minute
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: result.resetTime
    })
  }
  
  res.set('X-RateLimit-Remaining', result.remaining.toString())
  res.set('X-RateLimit-Reset', result.resetTime.toString())
  
  next()
})
```

## Performance Optimization

### Memory Management

```typescript
// Configure LRU cache size
const cache = new Cache({
  connection: undefined,
  opts: {
    namespace: 'my-app',
    usesLRUMemory: true,
    // LRU cache is configured internally with sensible defaults
  }
})
```

### Connection Pooling

```typescript
// Redis connection pooling is handled automatically
const cache = new Cache({
  connection: 'redis://localhost:6379',
  opts: {
    namespace: 'my-app',
    // Connection pooling is managed by the underlying Redis client
  }
})
```

### Monitoring and Metrics

```typescript
class CacheMetrics {
  private cache: Cache<any>
  private metrics: any
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'metrics',
        usesLRUMemory: true
      }
    })
    
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }
  }
  
  async get(key: string) {
    const value = await this.cache.get(key)
    if (value) {
      this.metrics.hits++
    } else {
      this.metrics.misses++
    }
    return value
  }
  
  async set(key: string, value: any, ttl?: number) {
    this.metrics.sets++
    return await this.cache.set(key, value, ttl)
  }
  
  async delete(key: string) {
    this.metrics.deletes++
    return await this.cache.delete(key)
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses),
      totalOperations: this.metrics.hits + this.metrics.misses + this.metrics.sets + this.metrics.deletes
    }
  }
}
```

## Error Handling

### Graceful Degradation

```typescript
class ResilientCache {
  private cache: Cache<any>
  private fallbackCache: Map<string, any>
  
  constructor() {
    this.cache = new Cache({
      connection: process.env.REDIS_URL,
      opts: {
        namespace: 'resilient'
      }
    })
    
    this.fallbackCache = new Map()
  }
  
  async get(key: string) {
    try {
      return await this.cache.get(key)
    } catch (error) {
      console.warn('Cache get failed, using fallback:', error)
      return this.fallbackCache.get(key)
    }
  }
  
  async set(key: string, value: any, ttl?: number) {
    try {
      await this.cache.set(key, value, ttl)
    } catch (error) {
      console.warn('Cache set failed, using fallback:', error)
      this.fallbackCache.set(key, value)
      
      // Clean up fallback cache if it gets too large
      if (this.fallbackCache.size > 1000) {
        this.fallbackCache.clear()
      }
    }
  }
  
  async remember(key: string, ttl: number, fn: () => Promise<any>) {
    try {
      return await this.cache.remember(key, ttl, fn)
    } catch (error) {
      console.warn('Cache remember failed, executing function directly:', error)
      return await fn()
    }
  }
}
```

## Testing

### Mock Cache for Testing

```typescript
class MockCache {
  private store: Map<string, any>
  
  constructor() {
    this.store = new Map()
  }
  
  async get(key: string) {
    return this.store.get(key)
  }
  
  async set(key: string, value: any, ttl?: number) {
    this.store.set(key, value)
    
    if (ttl) {
      setTimeout(() => {
        this.store.delete(key)
      }, ttl)
    }
  }
  
  async delete(key: string) {
    return this.store.delete(key)
  }
  
  async has(key: string) {
    return this.store.has(key)
  }
  
  async flush() {
    this.store.clear()
  }
}

// Use in tests
const cache = process.env.NODE_ENV === 'test' 
  ? new MockCache() 
  : new Cache({ connection: process.env.REDIS_URL })
```

## Configuration

### Environment Variables

```typescript
// .env file
REDIS_URL=redis://localhost:6379
CACHE_NAMESPACE=my-app
CACHE_DEFAULT_TTL=300000
CACHE_USE_LRU_MEMORY=true

// Configuration
const cache = new Cache({
  connection: process.env.REDIS_URL,
  opts: {
    namespace: process.env.CACHE_NAMESPACE || 'default',
    usesLRUMemory: process.env.CACHE_USE_LRU_MEMORY === 'true'
  }
})
```

## Contributing

The node-backend package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.
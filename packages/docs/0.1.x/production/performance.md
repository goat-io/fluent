# Performance Optimization

This guide covers comprehensive performance optimization strategies for Fluent applications in production environments.

## Overview

Performance optimization is crucial for providing excellent user experience and efficient resource utilization. This guide covers optimization strategies at the application, database, and infrastructure levels.

## Application Performance

### 1. Node.js Optimization

```typescript
// Optimize Node.js runtime
process.env.NODE_OPTIONS = [
  '--max-old-space-size=4096',      // Increase heap size
  '--optimize-for-size',            // Optimize for memory usage
  '--gc-interval=100',              // Garbage collection interval
  '--expose-gc'                     // Enable manual GC
].join(' ');

// Application startup optimization
export class ApplicationBootstrap {
  static async initialize(): Promise<void> {
    // Preload critical modules
    await this.preloadModules();
    
    // Initialize connection pools
    await this.initializeConnections();
    
    // Warm up caches
    await this.warmUpCaches();
    
    // Register cleanup handlers
    this.registerCleanupHandlers();
  }
  
  private static async preloadModules(): Promise<void> {
    // Preload commonly used modules
    await Promise.all([
      import('bcryptjs'),
      import('jsonwebtoken'),
      import('joi'),
      import('lodash')
    ]);
  }
  
  private static async initializeConnections(): Promise<void> {
    // Pre-initialize database connections
    await connector.initialize();
    
    // Pre-initialize Redis connections
    await redis.connect();
  }
  
  private static async warmUpCaches(): Promise<void> {
    // Warm up frequently accessed data
    await this.cacheStaticData();
    await this.cacheUserPermissions();
  }
  
  private static registerCleanupHandlers(): void {
    process.on('SIGTERM', async () => {
      await this.gracefulShutdown();
    });
    
    process.on('SIGINT', async () => {
      await this.gracefulShutdown();
    });
  }
  
  private static async gracefulShutdown(): Promise<void> {
    // Close connections gracefully
    await connector.close();
    await redis.disconnect();
    process.exit(0);
  }
}
```

### 2. Memory Management

```typescript
// Memory monitoring and optimization
export class MemoryManager {
  private static readonly MAX_HEAP_USAGE = 0.85; // 85% of max heap
  private static readonly GC_INTERVAL = 60000; // 1 minute
  
  static startMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = usage.heapUsed / usage.heapTotal;
      
      if (heapUsedPercent > this.MAX_HEAP_USAGE) {
        this.forceGarbageCollection();
      }
      
      this.logMemoryUsage(usage);
    }, this.GC_INTERVAL);
  }
  
  private static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection');
    }
  }
  
  private static logMemoryUsage(usage: NodeJS.MemoryUsage): void {
    console.log('Memory Usage:', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
    });
  }
  
  // Object pooling for frequently created objects
  private static objectPool = new Map<string, any[]>();
  
  static getPooledObject<T>(type: string, factory: () => T): T {
    const pool = this.objectPool.get(type) || [];
    
    if (pool.length > 0) {
      return pool.pop() as T;
    }
    
    return factory();
  }
  
  static releasePooledObject(type: string, object: any): void {
    const pool = this.objectPool.get(type) || [];
    
    if (pool.length < 100) { // Limit pool size
      pool.push(object);
      this.objectPool.set(type, pool);
    }
  }
}
```

### 3. Caching Strategy

```typescript
import Redis from 'ioredis';
import NodeCache from 'node-cache';

// Multi-level caching
export class CacheManager {
  private static redis: Redis;
  private static localCache: NodeCache;
  
  static initialize(): void {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      
      // Connection pooling
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      
      // Compression
      compression: 'gzip'
    });
    
    this.localCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // Check expired keys every minute
      maxKeys: 1000 // Limit memory usage
    });
  }
  
  static async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const localResult = this.localCache.get<T>(key);
    if (localResult !== undefined) {
      return localResult;
    }
    
    // Try Redis cache
    try {
      const redisResult = await this.redis.get(key);
      if (redisResult) {
        const parsed = JSON.parse(redisResult);
        
        // Store in local cache for faster access
        this.localCache.set(key, parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }
    
    return null;
  }
  
  static async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    // Store in local cache
    this.localCache.set(key, value, ttl);
    
    // Store in Redis cache
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache error:', error);
    }
  }
  
  static async invalidate(pattern: string): Promise<void> {
    // Clear local cache
    this.localCache.flushAll();
    
    // Clear Redis cache
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }
  }
  
  // Cache warming
  static async warmUpCache(): Promise<void> {
    const warmUpTasks = [
      this.cacheStaticData(),
      this.cacheUserPermissions(),
      this.cachePopularContent()
    ];
    
    await Promise.all(warmUpTasks);
  }
  
  private static async cacheStaticData(): Promise<void> {
    // Cache static configuration data
    const config = await this.loadStaticConfig();
    await this.set('static:config', config, 3600); // 1 hour
  }
  
  private static async cacheUserPermissions(): Promise<void> {
    // Cache user permissions
    const permissions = await this.loadUserPermissions();
    await this.set('permissions:all', permissions, 1800); // 30 minutes
  }
  
  private static async cachePopularContent(): Promise<void> {
    // Cache popular posts/content
    const popularPosts = await this.loadPopularPosts();
    await this.set('posts:popular', popularPosts, 900); // 15 minutes
  }
}
```

## Database Performance

### 1. Query Optimization

```typescript
// Optimized query patterns
export class OptimizedQueries {
  // Use proper indexing and query optimization
  static async findUserPosts(
    connector: BaseConnector,
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Post[]> {
    // Optimized query with proper indexes
    const query = `
      SELECT p.*, u.firstName, u.lastName, u.avatar
      FROM posts p
      INNER JOIN users u ON p.userId = u.id
      WHERE p.userId = $1 AND p.status = 'published'
      ORDER BY p.createdAt DESC
      LIMIT $2 OFFSET $3
    `;
    
    return connector.query(query, [userId, limit, offset]);
  }
  
  // Batch operations to reduce database calls
  static async batchUpdateViews(
    connector: BaseConnector,
    postIds: string[]
  ): Promise<void> {
    const query = `
      UPDATE posts
      SET viewCount = viewCount + 1
      WHERE id = ANY($1)
    `;
    
    await connector.query(query, [postIds]);
  }
  
  // Use materialized views for complex queries
  static async getAnalyticsSummary(
    connector: BaseConnector,
    timeRange: string
  ): Promise<any> {
    // Use materialized view for better performance
    const query = `
      SELECT * FROM analytics_summary_mv
      WHERE time_range = $1
    `;
    
    return connector.query(query, [timeRange]);
  }
  
  // Connection pooling optimization
  static async bulkInsert<T>(
    connector: BaseConnector,
    table: string,
    data: T[]
  ): Promise<void> {
    const batchSize = 1000;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const values = batch.map((_, index) => 
        `($${index * 2 + 1}, $${index * 2 + 2})`
      ).join(', ');
      
      const query = `INSERT INTO ${table} (column1, column2) VALUES ${values}`;
      const params = batch.flatMap(item => [item.column1, item.column2]);
      
      await connector.query(query, params);
    }
  }
}
```

### 2. Connection Pool Optimization

```typescript
// Optimized connection pool configuration
export const optimizedDbConfig = {
  // Connection pool settings
  pool: {
    min: 2,                    // Minimum connections
    max: 20,                   // Maximum connections
    idle: 30000,               // 30 seconds idle timeout
    acquire: 60000,            // 60 seconds acquire timeout
    evict: 1000,               // Eviction run interval
    
    // Connection validation
    validate: async (connection: any) => {
      try {
        await connection.query('SELECT 1');
        return true;
      } catch (error) {
        return false;
      }
    }
  },
  
  // Query optimization
  query: {
    timeout: 30000,            // 30 seconds query timeout
    retries: 3,                // Retry failed queries
    
    // Prepared statements
    prepare: true,
    
    // Query caching
    cache: {
      enabled: true,
      ttl: 300000,             // 5 minutes
      size: 1000               // Cache 1000 queries
    }
  },
  
  // Logging for performance monitoring
  logging: {
    enabled: process.env.NODE_ENV !== 'production',
    level: 'warn',
    logQueries: false,
    logSlowQueries: true,
    slowQueryThreshold: 1000   // Log queries > 1 second
  }
};
```

### 3. Database-Specific Optimizations

```typescript
// PostgreSQL specific optimizations
export class PostgreSQLOptimizer {
  static async optimizeVacuum(connector: BaseConnector): Promise<void> {
    // Analyze table statistics
    await connector.query('ANALYZE;');
    
    // Vacuum frequently updated tables
    const highUpdateTables = ['users', 'posts', 'activities'];
    for (const table of highUpdateTables) {
      await connector.query(`VACUUM ANALYZE ${table};`);
    }
  }
  
  static async createOptimalIndexes(connector: BaseConnector): Promise<void> {
    const indexes = [
      // Composite indexes for common queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_user_created ON posts(userId, createdAt DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_type ON activities(userId, type)',
      
      // Partial indexes for filtered queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published ON posts(createdAt DESC) WHERE status = \'published\'',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(id) WHERE status = \'active\'',
      
      // GIN indexes for full-text search
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_search ON posts USING gin(to_tsvector(\'english\', title || \' \' || content))',
      
      // Hash indexes for equality queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash ON users USING hash(email)'
    ];
    
    for (const index of indexes) {
      try {
        await connector.query(index);
      } catch (error) {
        console.error(`Failed to create index: ${index}`, error);
      }
    }
  }
}

// MongoDB specific optimizations
export class MongoDBOptimizer {
  static async optimizeIndexes(db: any): Promise<void> {
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const coll = db.collection(collection.name);
      
      // Analyze index usage
      const indexStats = await coll.aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      // Remove unused indexes
      for (const stat of indexStats) {
        if (stat.accesses.ops === 0 && stat.name !== '_id_') {
          await coll.dropIndex(stat.name);
          console.log(`Dropped unused index: ${stat.name}`);
        }
      }
    }
  }
  
  static async createOptimalIndexes(db: any): Promise<void> {
    const users = db.collection('users');
    const posts = db.collection('posts');
    const activities = db.collection('activities');
    
    // Create optimized indexes
    await Promise.all([
      users.createIndex({ email: 1 }, { unique: true }),
      users.createIndex({ createdAt: -1 }),
      posts.createIndex({ userId: 1, createdAt: -1 }),
      posts.createIndex({ status: 1, createdAt: -1 }),
      activities.createIndex({ userId: 1, type: 1, createdAt: -1 }),
      
      // Text search indexes
      posts.createIndex({
        title: 'text',
        content: 'text'
      }, {
        weights: { title: 10, content: 5 }
      })
    ]);
  }
}
```

## API Performance

### 1. Response Optimization

```typescript
// Response compression and optimization
import compression from 'compression';
import { Response } from 'express';

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,        // Good balance of compression vs CPU
  threshold: 1024, // Only compress responses > 1KB
  memLevel: 8      // Memory usage level
});

// Response optimization utilities
export class ResponseOptimizer {
  static sendOptimizedResponse(
    res: Response,
    data: any,
    statusCode: number = 200
  ): void {
    // Set appropriate cache headers
    if (statusCode === 200) {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
    
    // Remove sensitive fields
    const cleanData = this.sanitizeResponseData(data);
    
    // Send compressed response
    res.status(statusCode).json(cleanData);
  }
  
  static sendPaginatedResponse(
    res: Response,
    data: any[],
    page: number,
    limit: number,
    total: number
  ): void {
    const response = {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
    
    res.set('X-Total-Count', total.toString());
    res.json(response);
  }
  
  private static sanitizeResponseData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeResponseData(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      // Remove sensitive fields
      const sensitiveFields = ['password', 'privateKey', 'secret'];
      sensitiveFields.forEach(field => {
        delete sanitized[field];
      });
      
      return sanitized;
    }
    
    return data;
  }
}
```

### 2. Request Optimization

```typescript
// Request parsing optimization
export class RequestOptimizer {
  static optimizeBodyParser(): any {
    return {
      json: {
        limit: '10mb',
        strict: true,
        type: 'application/json'
      },
      urlencoded: {
        limit: '10mb',
        extended: true,
        parameterLimit: 20
      },
      raw: {
        limit: '50mb',
        type: 'application/octet-stream'
      }
    };
  }
  
  static async preProcessRequest(req: any, res: any, next: any): Promise<void> {
    // Request size validation
    if (req.headers['content-length'] > 50 * 1024 * 1024) { // 50MB
      return res.status(413).json({ error: 'Request too large' });
    }
    
    // Request timeout
    req.setTimeout(30000, () => {
      res.status(408).json({ error: 'Request timeout' });
    });
    
    next();
  }
}
```

## Front-end Performance

### 1. Asset Optimization

```typescript
// Asset optimization configuration
export const assetOptimization = {
  // Image optimization
  images: {
    formats: ['webp', 'avif', 'jpeg', 'png'],
    sizes: [320, 640, 960, 1280, 1920],
    quality: 80,
    
    // Lazy loading
    lazyLoad: true,
    placeholder: 'blur',
    
    // CDN configuration
    cdn: {
      enabled: true,
      baseUrl: process.env.CDN_BASE_URL,
      domains: ['images.yourdomain.com']
    }
  },
  
  // JavaScript optimization
  javascript: {
    minify: true,
    compress: true,
    mangle: true,
    
    // Code splitting
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  
  // CSS optimization
  css: {
    minify: true,
    purge: true,
    extract: true,
    
    // Critical CSS
    critical: {
      enabled: true,
      inline: true,
      extract: true
    }
  }
};
```

### 2. Bundle Optimization

```typescript
// Webpack optimization configuration
export const webpackOptimization = {
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true
        }
      }
    },
    
    // Runtime chunk
    runtimeChunk: 'single',
    
    // Module concatenation
    concatenateModules: true,
    
    // Tree shaking
    usedExports: true,
    sideEffects: false
  },
  
  // Performance hints
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
```

## Monitoring & Profiling

### 1. Performance Monitoring

```typescript
import { performance } from 'perf_hooks';

// Performance monitoring
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();
  
  static startTimer(name: string): () => void {
    const start = performance.now();
    
    return () => {
      const end = performance.now();
      const duration = end - start;
      
      this.recordMetric(name, duration);
    };
  }
  
  static recordMetric(name: string, value: number): void {
    const existing = this.metrics.get(name) || [];
    existing.push(value);
    
    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.metrics.set(name, existing);
  }
  
  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      result[name] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99)
      };
    }
    
    return result;
  }
  
  private static percentile(values: number[], p: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Performance monitoring middleware
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const timer = PerformanceMonitor.startTimer(`${req.method} ${req.route?.path || req.path}`);
  
  res.on('finish', () => {
    timer();
  });
  
  next();
};
```

### 2. Application Profiling

```typescript
// Application profiling
export class ApplicationProfiler {
  static async profileFunction<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = process.hrtime.bigint();
    const memBefore = process.memoryUsage();
    
    try {
      const result = await fn();
      
      const end = process.hrtime.bigint();
      const memAfter = process.memoryUsage();
      
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      const memDiff = memAfter.heapUsed - memBefore.heapUsed;
      
      console.log(`Profile [${name}]:`, {
        duration: `${duration.toFixed(2)}ms`,
        memory: `${(memDiff / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });
      
      return result;
    } catch (error) {
      console.error(`Profile [${name}] failed:`, error);
      throw error;
    }
  }
  
  static generateReport(): any {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform
    };
  }
}
```

## Load Testing

### 1. Load Testing Scripts

```javascript
// Artillery load testing configuration
module.exports = {
  config: {
    target: 'https://your-api.com',
    phases: [
      {
        duration: 60,
        arrivalRate: 10,
        name: 'Warm up'
      },
      {
        duration: 120,
        arrivalRate: 50,
        name: 'Ramp up load'
      },
      {
        duration: 300,
        arrivalRate: 100,
        name: 'Sustained load'
      }
    ],
    defaults: {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  },
  scenarios: [
    {
      name: 'API Load Test',
      weight: 100,
      flow: [
        {
          post: {
            url: '/api/auth/login',
            json: {
              email: 'test@example.com',
              password: 'password123'
            },
            capture: {
              json: '$.token',
              as: 'token'
            }
          }
        },
        {
          get: {
            url: '/api/posts',
            headers: {
              'Authorization': 'Bearer {{ token }}'
            }
          }
        },
        {
          post: {
            url: '/api/posts',
            headers: {
              'Authorization': 'Bearer {{ token }}'
            },
            json: {
              title: 'Test Post {{ $randomString() }}',
              content: 'This is a test post content'
            }
          }
        }
      ]
    }
  ]
};
```

### 2. Performance Testing

```typescript
// Performance testing utilities
export class PerformanceTester {
  static async loadTest(
    endpoint: string,
    options: {
      concurrency: number;
      duration: number;
      method: string;
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    const results: any[] = [];
    const startTime = Date.now();
    
    const workers = Array(options.concurrency).fill(null).map(async () => {
      while (Date.now() - startTime < options.duration * 1000) {
        const requestStart = Date.now();
        
        try {
          const response = await fetch(endpoint, {
            method: options.method,
            headers: options.headers,
            body: options.body ? JSON.stringify(options.body) : undefined
          });
          
          const requestEnd = Date.now();
          results.push({
            status: response.status,
            duration: requestEnd - requestStart,
            success: response.ok
          });
        } catch (error) {
          results.push({
            status: 0,
            duration: Date.now() - requestStart,
            success: false,
            error: error.message
          });
        }
      }
    });
    
    await Promise.all(workers);
    
    return this.analyzeResults(results);
  }
  
  private static analyzeResults(results: any[]): any {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const durations = successful.map(r => r.duration);
    
    return {
      totalRequests: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / results.length) * 100,
      
      responseTime: {
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      },
      
      requestsPerSecond: results.length / (results.length > 0 ? 
        Math.max(...results.map(r => r.duration)) / 1000 : 1)
    };
  }
  
  private static percentile(values: number[], p: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

## Performance Checklist

### Application Performance
- [ ] Node.js runtime optimized
- [ ] Memory management implemented
- [ ] Multi-level caching configured
- [ ] Connection pooling optimized
- [ ] Query optimization implemented
- [ ] Response compression enabled
- [ ] Asset optimization configured

### Database Performance
- [ ] Proper indexes created
- [ ] Query optimization implemented
- [ ] Connection pooling configured
- [ ] Database-specific optimizations applied
- [ ] Slow query monitoring enabled

### Frontend Performance
- [ ] Code splitting implemented
- [ ] Asset optimization configured
- [ ] Lazy loading enabled
- [ ] CDN configured
- [ ] Critical CSS inlined

### Monitoring & Testing
- [ ] Performance monitoring implemented
- [ ] Application profiling configured
- [ ] Load testing scripts prepared
- [ ] Performance metrics collected
- [ ] Alerts configured for performance issues

## Next Steps

1. [Deployment Guides](../deployment/docker.md) - Deploy optimized application
2. [Operations Monitoring](../operations/monitoring.md) - Monitor application performance
3. [Troubleshooting Performance](../troubleshooting/performance-issues.md) - Debug performance issues
4. [Scaling Strategies](../operations/scaling.md) - Scale your application
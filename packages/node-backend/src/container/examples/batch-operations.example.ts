// Example: How to use Container batch operations
// Run with: npx tsx ./src/container/examples/batch-operations.example.ts

import { Container } from '../Container'

// Define service types
interface Database {
  connect: () => Promise<void>
  query: (sql: string) => Promise<any[]>
  dispose?: () => Promise<void>
}

interface Cache {
  get: (key: string) => Promise<any>
  set: (key: string, value: any) => Promise<void>
}

interface UserApi {
  getAll: () => Promise<any[]>
  getById: (id: string) => Promise<any>
}

// Define service factories using the Container factory pattern
interface ServiceFactories extends Record<string, unknown> {
  database: (connectionString: string) => Database
  cache: (redisUrl: string) => Cache
  api: {
    users: (db: Database, cache: Cache) => UserApi
  }
}

// Define tenant metadata
interface TenantMetadata {
  id: string
  name: string
  connectionString: string
  redisUrl: string
  tier: 'free' | 'pro' | 'enterprise'
}

// Create factories following the Container pattern
const factories: ServiceFactories = {
  database: (connectionString: string) => ({
    connect: async () => {
      console.log(`Connected to database: ${connectionString}`)
    },
    query: async (sql: string) => {
      console.log(`Executing query: ${sql}`)
      return []
    },
    dispose: async () => {
      console.log('Database connection closed')
    },
  }),
  cache: (redisUrl: string) => ({
    get: async (key: string) => {
      console.log(`Cache GET: ${key}`)
      return null
    },
    set: async (key: string, value: any) => {
      console.log(`Cache SET: ${key} = ${JSON.stringify(value)}`)
    },
  }),
  api: {
    users: (db: Database, cache: Cache) => ({
      getAll: async () => {
        const cached = await cache.get('users:all')
        if (cached) return cached
        
        const users = await db.query('SELECT * FROM users')
        await cache.set('users:all', users)
        return users
      },
      getById: async (id: string) => {
        const cached = await cache.get(`users:${id}`)
        if (cached) return cached
        
        const [user] = await db.query(`SELECT * FROM users WHERE id = ${id}`)
        await cache.set(`users:${id}`, user)
        return user
      },
    }),
  },
}

// Create container with initializer
const container = new Container<ServiceFactories, TenantMetadata>(
  factories,
  async (preload, meta) => {
    console.log(`\nInitializing services for tenant: ${meta.name} (${meta.id})`)
    
    // Create service instances using the preload structure
    const db = preload.database(meta.id, meta.connectionString)
    await db.connect()
    
    const cache = preload.cache(meta.id, meta.redisUrl)
    
    return {
      database: db,
      cache: cache,
      api: {
        users: preload.api.users(meta.id, db, cache),
      },
    } as any // Type assertion needed due to complex nested structure
  },
  {
    enableMetrics: true,
    enableDiagnostics: true,
  }
)

// Example tenants to process
const tenants: TenantMetadata[] = [
  {
    id: 'tenant-1',
    name: 'Acme Corp',
    connectionString: 'postgres://acme:pass@db/acme',
    redisUrl: 'redis://cache:6379/1',
    tier: 'enterprise',
  },
  {
    id: 'tenant-2',
    name: 'Globex Inc',
    connectionString: 'postgres://globex:pass@db/globex',
    redisUrl: 'redis://cache:6379/2',
    tier: 'pro',
  },
  {
    id: 'tenant-3',
    name: 'Initech LLC',
    connectionString: 'postgres://initech:pass@db/initech',
    redisUrl: 'redis://cache:6379/3',
    tier: 'free',
  },
  {
    id: 'tenant-4',
    name: 'Umbrella Corp',
    connectionString: 'postgres://umbrella:pass@db/umbrella',
    redisUrl: 'redis://cache:6379/4',
    tier: 'enterprise',
  },
  {
    id: 'tenant-5',
    name: 'Wayne Enterprises',
    connectionString: 'postgres://wayne:pass@db/wayne',
    redisUrl: 'redis://cache:6379/5',
    tier: 'enterprise',
  },
]

async function demonstrateBatchOperations() {
  console.log('===== Container Batch Operations Demo =====\n')
  
  // Example 1: Bootstrap multiple tenants with progress tracking
  console.log('1. Bootstrapping multiple tenants with custom work:')
  
  const startTime = Date.now()
  const results = await container.bootstrapBatch(
    tenants.map(metadata => ({
      metadata,
      fn: async () => {
        // Simulate some work for each tenant
        const { api } = container.context
        const users = await api?.users.getAll() || []
        console.log(`  ✓ Processed tenant ${metadata.name}`)
        return { tenantId: metadata.id, userCount: users.length }
      },
    })),
    {
      concurrency: 3, // Process 3 tenants at a time
      continueOnError: true,
      onProgress: (completed, total, current) => {
        console.log(`Progress: ${completed}/${total} tenants processed`)
      },
    }
  )
  
  const duration = Date.now() - startTime
  console.log(`\nBatch bootstrap completed in ${duration}ms`)
  
  // Show results summary
  console.log('\nResults summary:')
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`  ✓ ${result.metadata.name}: Success (${result.metrics?.duration}ms)`)
    } else {
      console.log(`  ✗ ${result.metadata.name}: Failed - ${result.error?.message}`)
    }
  })
  
  // Example 2: Invalidate caches for specific tenants
  console.log('\n\n2. Batch cache invalidation for specific tenants:')
  
  const tenantsToInvalidate = ['tenant-1', 'tenant-3', 'tenant-5']
  const invalidationResult = await container.invalidateTenantBatch(
    tenantsToInvalidate,
    'Scheduled maintenance'
  )
  
  console.log(`Invalidated ${invalidationResult.succeeded} out of ${invalidationResult.total} tenant caches`)
  
  // Example 3: Bootstrap with timeout
  console.log('\n\n3. Bootstrap with timeout:')
  
  const timeoutResults = await container.bootstrapBatch(
    [tenants[0]].map(metadata => ({
      metadata,
      fn: async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100))
        return { processed: true }
      },
    })),
    {
      timeout: 200, // 200ms timeout
    }
  )
  
  console.log(`Timeout test result: ${timeoutResults[0].status}`)
  
  // Show final metrics
  console.log('\n\n===== Final Metrics =====')
  console.log(container.getMetrics())
  
  // Cleanup
  await container.disposeAll()
}

// Run the demo
demonstrateBatchOperations().catch(console.error)
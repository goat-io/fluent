# @goatlab/node-backend

Common tools for Node.js backend applications, including caching, secret management, Express/tRPC integration, and testing utilities.

## Installation

```bash
npm install @goatlab/node-backend
# or
yarn add @goatlab/node-backend
# or
pnpm add @goatlab/node-backend
```

## Basic Usage

```typescript
import { Cache } from '@goatlab/node-backend'

// Use Redis cache
const redisCache = new Cache({
  connection: 'redis://localhost:6379',
  opts: { namespace: 'my-app' }
})

// Use in-memory LRU cache
const memoryCache = new Cache({
  connection: undefined,
  opts: { namespace: 'my-app' }
})

// Cache with LRU memory layer for improved performance
const hybridCache = new Cache({
  connection: 'redis://localhost:6379',
  opts: { 
    namespace: 'my-app',
    usesLRUMemory: true // Adds LRU memory caching layer
  }
})

// Basic operations
await cache.set('key', { data: 'value' }, 60000) // TTL in milliseconds
const value = await cache.get('key')
await cache.delete('key')

// Advanced operations
const result = await cache.remember('expensive-op', 300000, async () => {
  // This function only runs if key doesn't exist
  return await expensiveOperation()
})
```

## Key Features

- **Dual Storage**: Supports Redis for distributed caching or in-memory LRU for single instances
- **Multi-tenancy**: Built-in tenant isolation with namespace support
- **Memory Layer**: Optional LRU memory caching on top of Redis for improved performance
- **Cache Helpers**: Laravel-inspired helper methods like `remember()`, `rememberForever()`, and `pull()`
- **Namespace Operations**: Delete or retrieve values by key prefix with `deleteWhereStartsWith()` and `getValueWhereKeyStartsWith()`
- **Type Safety**: Full TypeScript support with generic types
- **Automatic Validation**: Skips caching of null, undefined, empty strings, empty arrays, and empty objects

## Secret Management

The `SecretService` provides secure secret management with support for multiple backends and preloading:

```typescript
import { SecretService } from '@goatlab/node-backend'

// File-based encrypted secrets with TTL caching
const fileSecrets = new SecretService({
  provider: 'FILE',
  location: '/path/to/secrets.json',
  encryptionKey: process.env.ENCRYPTION_KEY,
  cacheTTL: 300000 // 5 minutes (optional, default: 5 minutes)
})

// HashiCorp Vault integration
const vaultSecrets = new SecretService({
  provider: 'VAULT',
  location: 'my-app/secrets',
  encryptionKey: process.env.ENCRYPTION_KEY
})

// Environment variables
const envSecrets = new SecretService({
  provider: 'ENV',
  location: 'APP', // Loads APP_* env vars
  encryptionKey: process.env.ENCRYPTION_KEY // Now supports encryption for all providers
})

// Preload secrets for synchronous access (new!)
await fileSecrets.preload()
const apiKey = fileSecrets.getSecretSync('API_KEY') // Synchronous!
const config = fileSecrets.getSecretJsonSync('CONFIG') // Synchronous!

// Async operations still available
const apiKeyAsync = await fileSecrets.getSecret('API_KEY')
const configAsync = await fileSecrets.getSecretJson('CONFIG')

// Store secrets (FILE and VAULT providers)
await fileSecrets.storeSecrets({ API_KEY: 'secret-value' })

// Manual cache cleanup
SecretService.cleanupExpiredCache()

// Dispose when done (stops file watching)
fileSecrets.dispose()
```

### Secret Provider Features

- **FILE**: Encrypted local file storage using AES encryption with file watching
- **VAULT**: HashiCorp Vault integration with automatic token management  
- **ENV**: Runtime environment variable access with encryption support
- **Preloading**: Load secrets once async, access synchronously afterward
- **Per-Tenant Encryption**: Each tenant can have its own encryption key
- **Automatic Invalidation**: File changes trigger automatic reload (FILE provider)
- **TTL Caching**: Configurable time-to-live caching with automatic expiration
- **Type Safety**: Generic type support for JSON secrets

### Preloading Pattern with Container

```typescript
const container = new Container(factories, async (preload, meta) => {
  // Create and preload secret service
  const secretService = preload.secrets(meta.tenantId, {
    provider: 'FILE',
    location: meta.secretsLocation,
    encryptionKey: meta.encryptionKey
  })
  
  await secretService.preload() // Load once async
  
  // Use sync methods for instant access
  const dbUrl = secretService.getSecretSync('DATABASE_URL')
  const apiKey = secretService.getSecretSync('API_KEY')
  
  // Create other services with preloaded secrets
  const database = preload.database(meta.tenantId, { url: dbUrl })
  const api = preload.api(meta.tenantId, { apiKey })
  
  return { secrets: secretService, database, api }
})
```

## Express + tRPC Integration

Helper for creating Express applications with tRPC integration:

```typescript
import { getExpressTrpcApp } from '@goatlab/node-backend'
import { initTRPC } from '@trpc/server'

const t = initTRPC.create()
const appRouter = t.router({
  hello: t.procedure.query(() => 'Hello World!')
})

// Minimal configuration - just trpcRouter is required
const { app, server, waitForShutdown } = getExpressTrpcApp({ 
  trpcRouter: appRouter 
})

// Keep the process alive until shutdown
await waitForShutdown()

// With custom configuration
const { app, server, waitForShutdown } = getExpressTrpcApp({
  trpcRouter: appRouter,
  port: 8080,
  environment: 'prod',
  appName: 'My API',
  
  // Feature flags
  features: {
    openApiDocs: true,
    sentry: true,
    trustProxy: true
  },
  
  // Security customization
  security: {
    cors: {
      allowedOrigins: ['https://myapp.com'],
      maxAge: 7200
    },
    rateLimit: {
      api: { max: 1000 }
    }
  },
  
  // Optional extensions
  expressResources: [customRouter],
  customHandlers: [middleware1, middleware2],
  sentryService
})
```

### Configuration (New!)

The `getExpressTrpcApp` function now uses a fully typed configuration object instead of process.env variables:

- **Minimal config**: Only `trpcRouter` is required
- **Deep merging**: Customize specific settings without losing defaults
- **Type safety**: Full TypeScript support for all configuration options
- **Environment-aware**: Automatically adjusts defaults based on environment
- **Graceful shutdown**: Use `waitForShutdown()` to keep the process alive until the server closes

### Performance Features (New!)

- **Optimized Compression**: Automatically skips compression for small responses (<1KB), SSE, WebSocket upgrades, and pre-compressed content
- **Memory Monitoring**: Built-in middleware tracks heap usage and triggers garbage collection when needed
- **Smart Rate Limiting**: Different limits for auth endpoints, API endpoints, and general routes

## Container - Dependency Injection

Multi-tenant dependency injection container with performance optimizations:

```typescript
import { Container } from '@goatlab/node-backend'

// Define your service factories
const factories = {
  database: DatabaseService,
  api: ApiService,
  cache: CacheService
}

// Create container with initializer
const container = new Container(factories, async (preload, tenantMeta) => {
  const db = preload.database(tenantMeta.id, tenantMeta.dbConfig)
  const cache = preload.cache(tenantMeta.id)
  
  return {
    database: db,
    api: preload.api(tenantMeta.id, db),
    cache
  }
})

// Bootstrap for a tenant
await container.bootstrap(tenantMeta, async () => {
  const { database, api } = container.context
  // Use services...
})

// Batch operations (new!)
const results = await container.bootstrapBatch([
  { metadata: tenant1, fn: processTenant1 },
  { metadata: tenant2, fn: processTenant2 }
], {
  concurrency: 10,
  continueOnError: true,
  onProgress: (completed, total) => console.log(`${completed}/${total}`)
})

// Batch cache invalidation (new!)
await container.invalidateTenantBatch(['tenant1', 'tenant2', 'tenant3'])
```

### Container Features

- **Multi-tenancy**: Isolated service instances per tenant
- **Batch Operations**: Process multiple tenants in parallel with concurrency control
- **Performance Metrics**: Built-in performance tracking and statistics
- **Cache Management**: Efficient caching with batch invalidation support
- **Type Safety**: Full TypeScript support with inference

## Translation Service

High-performance translation service with template caching:

```typescript
import { translationService } from '@goatlab/node-backend'

// Translations are automatically loaded and cached
const greeting = translationService.translate('welcome', { language: 'es' })

// With template parameters
const message = translationService.translate('user.greeting', 
  { language: 'en' }, 
  { name: 'John' }
)

// Performance optimized with:
// - Compiled template caching
// - Locale preloading at startup
// - In-memory locale storage
```

## Testing Utilities

Comprehensive testing setup with testcontainers support:

- **Vitest Configuration**: Pre-configured vitest setup without globals
- **Testcontainers**: Redis and Vault containers for integration testing
- **Real Service Testing**: Test utilities that avoid mocking in favor of real services
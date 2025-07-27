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

The `SecretService` provides secure secret management with support for multiple backends:

```typescript
import { SecretService } from '@goatlab/node-backend'

// File-based encrypted secrets
const fileSecrets = new SecretService('FILE', '/path/to/secrets.json')

// HashiCorp Vault integration
const vaultSecrets = new SecretService('VAULT', 'my-app/secrets')

// Environment variables (new!)
const envSecrets = new SecretService('ENV', 'APP') // Loads APP_* env vars
const allEnvSecrets = new SecretService('ENV', '') // Loads all env vars

// Usage
await fileSecrets.loadSecrets()
const apiKey = await fileSecrets.getSecret('API_KEY')
const config = await fileSecrets.getSecretJson('CONFIG')

// Store secrets (FILE and VAULT providers)
await fileSecrets.storeSecrets({ API_KEY: 'secret-value' })
```

### Secret Provider Features

- **FILE**: Encrypted local file storage using AES encryption
- **VAULT**: HashiCorp Vault integration with automatic token management  
- **ENV**: Runtime environment variable access with optional prefix filtering
- **Caching**: Automatic in-memory caching for improved performance
- **Type Safety**: Generic type support for JSON secrets

## Express + tRPC Integration

Helper for creating Express applications with tRPC integration:

```typescript
import { getExpressTrpcApp } from '@goatlab/node-backend'
import { initTRPC } from '@trpc/server'

const t = initTRPC.create()
const appRouter = t.router({
  hello: t.procedure.query(() => 'Hello World!')
})

const app = getExpressTrpcApp({
  trpcRouter: appRouter,
  port: 3000,
  sentryService,
  expressResources: [customRouter], // Optional Express routers
  customHandlers: [middleware1, middleware2], // Optional middleware
  shouldInitOpenApiDocs: true, // Optional OpenAPI documentation
})
```

## Testing Utilities

Comprehensive testing setup with testcontainers support:

- **Vitest Configuration**: Pre-configured vitest setup without globals
- **Testcontainers**: Redis and Vault containers for integration testing
- **Real Service Testing**: Test utilities that avoid mocking in favor of real services
# @goatlab/node-backend

A flexible caching solution for Node.js applications that supports both Redis and in-memory LRU caching with multi-tenancy support.

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
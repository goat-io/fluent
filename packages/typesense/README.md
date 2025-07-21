# @goatlab/typesense

A modern, type-safe TypeScript wrapper for the Typesense search engine API. This package provides a comprehensive client with built-in resilience, multi-tenancy support, and a clean, grouped API interface.

## Installation

```bash
npm install @goatlab/typesense
# or
pnpm add @goatlab/typesense
# or
yarn add @goatlab/typesense
```

## Basic Usage

```typescript
import { TypesenseApi } from '@goatlab/typesense'

// Initialize the client
const typesense = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  collectionName: 'products' // default collection name
})

// Create a collection
await typesense.collections.create({
  name: 'products',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'price', type: 'float' },
    { name: 'description', type: 'string' }
  ]
})

// Insert a document
await typesense.documents.insert({
  id: '1',
  title: 'iPhone 15',
  price: 999.99,
  description: 'Latest Apple smartphone'
})

// Search documents
const results = await typesense.search.query({
  q: 'iphone',
  query_by: 'title,description'
})
```

## Key Features

- **Grouped API Interface**: Organized methods under logical namespaces (collections, documents, search, admin)
- **Full Type Safety**: Generic type support for document operations with compile-time checking
- **Multi-tenancy Support**: Built-in tenant isolation with automatic collection name prefixing
- **Resilience Features**: Circuit breaker pattern, rate limiting, and automatic retries
- **Schema Management**: Automatic schema caching and version compatibility checks
- **Stream Support**: Efficient document export with streaming capabilities
- **Advanced Search**: Support for text search, vector search, and multi-search operations

## Available Methods

### Collections
- `collections.create()` - Create a new collection
- `collections.get()` - Retrieve collection details
- `collections.update()` - Update collection schema
- `collections.delete()` - Delete a collection
- `collections.list()` - List all collections
- `collections.getOrCreate()` - Get existing or create new collection

### Documents
- `documents.insert()` - Insert a single document
- `documents.upsert()` - Insert or update a document
- `documents.update()` - Update an existing document
- `documents.delete()` - Delete a document by ID
- `documents.getById()` - Retrieve a document by ID
- `documents.import()` - Bulk import documents
- `documents.export()` - Export documents (with optional filtering)
- `documents.exportStream()` - Export documents as a stream
- `documents.deleteByFilter()` - Delete documents matching a filter
- `documents.clear()` - Clear all documents in a collection

### Search
- `search.query()` - Perform a search query
- `search.text()` - Text-based search
- `search.vector()` - Vector similarity search
- `search.multi()` - Execute multiple searches in one request

### Admin
- `admin.health()` - Check server health
- `admin.waitForHealth()` - Wait for server to be healthy
- `admin.getMetrics()` - Get server metrics
- `admin.getStats()` - Get server statistics
- `admin.getCollectionStats()` - Get collection-specific statistics

### Additional Features (v29+)
- **Aliases**: Create and manage collection aliases
- **Synonyms**: Define search synonyms
- **Overrides**: Set up search result overrides
- **Presets**: Configure search presets

## Type Safety

The TypesenseApi supports full type safety for document operations:

### Basic Typed API

```typescript
import { createTypedApi } from '@goatlab/typesense'

// Define your document type
interface Product {
  id: string
  title: string
  price: number
  inStock: boolean
}

// Create a typed API instance
const productApi = createTypedApi<Product>()({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  collectionName: 'products'
})

// All document operations are now type-safe
await productApi.documents.insert({
  id: '1',
  title: 'Widget',
  price: 99.99,
  inStock: true
}) // ✅ Typed

// TypeScript will catch errors at compile time
// await productApi.documents.insert({ id: '2', title: 'Gadget' })
// ❌ Error: missing 'price' and 'inStock'
```

### Direct Generic Usage

```typescript
const api = new TypesenseApi<Product>({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  collectionName: 'products'
})
```

## Multi-tenancy

The TypesenseApi provides built-in multi-tenancy support through collection-level isolation:

### Basic Tenant Setup

```typescript
// Create API instance with tenant ID
const api = new TypesenseApi({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  tenantId: 'acme',  // Tenant ID
  collectionName: 'products'
})

// All operations use tenant-prefixed collections automatically
// Collection name becomes: 'acme__products'
await api.documents.insert({ id: '1', name: 'Product' })
```

### Type-Safe Tenant APIs

```typescript
import { forTenant } from '@goatlab/typesense'

interface Customer {
  id: string
  name: string
  email: string
}

// Create tenant-specific APIs with compile-time safety
const tenant1Api = forTenant<Customer, 'tenant1'>('tenant1', {
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key',
  collectionName: 'customers'
})

// Tenant ID is preserved in the type
const tenantId: 'tenant1' = tenant1Api.tenantId // ✅ Type-safe
```

### Tenant Admin Operations

```typescript
// List all collections for a tenant
const collections = await api.listTenantCollections()
// Returns: ['acme__products', 'acme__users', ...]

// Get base collection names (without prefix)
const baseNames = await api.listTenantBaseCollectionNames()
// Returns: ['products', 'users', ...]

// Check if a collection exists
const exists = await api.tenantCollectionExists('products')

// Delete all tenant collections (use with caution!)
await api.deleteAllTenantCollections()
```

### Collection Naming Convention

Tenant collections follow the pattern: `<tenantId>__<baseCollectionName>`

- Tenant IDs are automatically sanitized (lowercase, alphanumeric + hyphens/underscores)
- Maximum tenant ID length: 128 characters
- Examples: `acme__products`, `tenant-123__users`

## Schema-based Type Safety

The TypesenseApi provides compile-time type safety for your collections using TypeScript's advanced type system:

### Define Collections with Type Inference

```typescript
import { TypesenseApi } from '@goatlab/typesense'

// Define your collection schema with proper const assertions
const ProductCollection = TypesenseApi.defineCollection({
  name: 'products',
  fields: [
    { name: 'id', type: 'string' as const },
    { name: 'title', type: 'string' as const },
    { name: 'description', type: 'string' as const, optional: true },
    { name: 'price', type: 'float' as const },
    { name: 'inStock', type: 'bool' as const },
    { name: 'tags', type: 'string[]' as const, optional: true },
    { name: 'rating', type: 'int32' as const, optional: true }
  ] as const
} as const)

// Create a strongly-typed API instance
const api = TypesenseApi.createSchemaTypedApi(ProductCollection)({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key'
})

// All operations are now fully typed with autocomplete
await api.documents.insert({
  id: 'prod-001',
  title: 'Laptop',           // ✅ Required, must be string
  price: 999.99,            // ✅ Required, must be number
  inStock: true,            // ✅ Required, must be boolean
  description: 'Gaming laptop', // ✅ Optional, can be omitted
  tags: ['gaming', 'laptop']   // ✅ Optional, must be string[]
})

// TypeScript will catch these errors at compile time:
// ❌ Missing required field
// await api.documents.insert({
//   id: 'prod-002',
//   price: 99.99,
//   inStock: true
//   // Error: Property 'title' is missing
// })

// ❌ Wrong type
// await api.documents.insert({
//   id: 'prod-003',
//   title: 'Product',
//   price: '99.99',  // Error: Type 'string' is not assignable to type 'number'
//   inStock: true
// })
```

### One-Step API Creation

For simpler cases, you can define and create the API in one step:

```typescript
const api = TypesenseApi.createFromSchema({
  name: 'products',
  fields: [
    { name: 'id', type: 'string' as const },
    { name: 'title', type: 'string' as const },
    { name: 'price', type: 'float' as const },
    { name: 'inStock', type: 'bool' as const }
  ] as const
} as const)({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key'
})
```

### Complex Field Types

The type inference supports all Typesense field types:

```typescript
const EventCollection = TypesenseApi.defineCollection({
  name: 'events',
  fields: [
    { name: 'id', type: 'string' as const },
    { name: 'name', type: 'string' as const },
    { name: 'timestamp', type: 'int64' as const },
    { name: 'location', type: 'geopoint' as const },      // [lat, lon] tuple
    { name: 'attendees', type: 'int32[]' as const, optional: true },
    { name: 'metadata', type: 'object' as const, optional: true },
    { name: 'tags', type: 'auto' as const, optional: true }  // string | string[]
  ] as const
} as const)

const api = TypesenseApi.createSchemaTypedApi(EventCollection)({
  prefixUrl: 'http://localhost:8108',
  token: 'your-api-key'
})

// Properly typed document
await api.documents.insert({
  id: 'evt-001',
  name: 'Tech Conference',
  timestamp: Date.now(),
  location: [37.7749, -122.4194],  // Geopoint as [lat, lon]
  attendees: [100, 200, 300],      // Optional int32 array
  metadata: { venue: 'Moscone Center' }  // Optional object
})
```

### Key Features

- **Compile-time type checking** - No runtime overhead
- **Full autocomplete support** - Your IDE knows all field names and types
- **Optional field handling** - Correctly distinguishes between required and optional fields
- **All Typesense types supported** - Including arrays, objects, geopoints, and auto fields
- **Zero runtime validation** - Pure TypeScript type inference

### Alternative Import Methods

The utility functions are also available as direct imports:

```typescript
import { defineCollection, createSchemaTypedApi } from '@goatlab/typesense'

const collection = defineCollection({...})
const api = createSchemaTypedApi(collection)({...})
```

### Type Mapping Reference

| Typesense Type | TypeScript Type |
|----------------|----------------|
| `string` | `string` |
| `string[]` | `string[]` |
| `int32`, `int64` | `number` |
| `int32[]`, `int64[]` | `number[]` |
| `float` | `number` |
| `float[]` | `number[]` |
| `bool` | `boolean` |
| `bool[]` | `boolean[]` |
| `geopoint` | `[number, number]` |
| `geopoint[]` | `[number, number][]` |
| `object` | `Record<string, any>` |
| `object[]` | `Record<string, any>[]` |
| `auto` | `string \| string[]` |

**Note**: The `id` field is excluded from the document type for `insert()` operations, as it's handled separately by the TypesenseApi with `WithRequiredId<T>` type.

## Advanced Configuration

```typescript
const typesense = new TypesenseApi({
  prefixUrl: 'https://typesense.example.com',
  token: 'your-api-key',
  
  // Multi-tenancy
  tenantId: 'customer-123',
  
  // Timeouts
  searchTimeout: 5000,
  importTimeout: 60000,
  defaultTimeout: 10000,
  
  // Resilience settings
  resilience: {
    maxFailures: 5,
    resetTimeout: 60000,
    halfOpenRequests: 3
  },
  
  // Other options
  autoCreateCollection: true,
  enableVersionCheck: true,
  suppressLogs: false
})
```

## Components

The package includes several utility components that can be used independently:

- `TypesenseHttpClient` - HTTP client with built-in authentication
- `ResiliencePolicy` - Circuit breaker and rate limiting implementation
- `CollectionSchemaManager` - Schema caching and management
- `TypesenseFilterBuilder` - Fluent filter query builder
- `ExportFormatter` - Document export formatting utilities
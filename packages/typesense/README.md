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
- **Multi-tenancy Support**: Built-in tenant isolation with automatic collection name prefixing
- **Resilience Features**: Circuit breaker pattern, rate limiting, and automatic retries
- **Type Safety**: Full TypeScript support with comprehensive type definitions
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
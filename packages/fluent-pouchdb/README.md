# @goatlab/fluent-pouchdb

PouchDB connector for the Goat Fluent query interface. Enables you to use PouchDB with the same unified API as other Fluent database connectors.

## Installation

```bash
npm install @goatlab/fluent-pouchdb
# or
yarn add @goatlab/fluent-pouchdb
# or
pnpm add @goatlab/fluent-pouchdb
```

## Basic Usage

```typescript
import { PouchDBConnector, PouchDB } from '@goatlab/fluent-pouchdb'
import { z } from 'zod'

// Define your schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  created: z.date().optional()
})

// Create PouchDB instance
const db = new PouchDB('users', { adapter: 'memory' }) // or use 'leveldb' for persistence

// Initialize connector
const users = new PouchDBConnector({
  entity: UserEntity, // Your entity class with decorators
  dataSource: db,
  inputSchema: UserSchema,
  outputSchema: UserSchema // optional, defaults to inputSchema
})

// Use Fluent API
const user = await users.insert({ 
  name: 'John Doe', 
  email: 'john@example.com' 
})

const found = await users.findMany({
  where: { email: { equals: 'john@example.com' } },
  orderBy: [{ created: 'desc' }],
  limit: 10
})
```

## Key Features

- **Unified Fluent API** - Same query interface as other Fluent connectors
- **Full CRUD operations** - insert, update, replace, delete with validation
- **Advanced querying** - Complex where clauses with AND/OR logic
- **Schema validation** - Input/output validation with Zod schemas
- **In-memory sorting** - orderBy support without PouchDB indexes
- **Pagination support** - Built-in pagination helpers
- **PouchDB plugins** - Pre-configured with find, memory adapter, and json plugins
- **Raw access** - Direct PouchDB database access via `.raw()` method
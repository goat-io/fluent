# @goatlab/fluent-pouchdb

PouchDB connector for the Goat Fluent query interface. Enables offline-first applications with automatic synchronization capabilities.

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
import { f } from '@goatlab/fluent'
import { z } from 'zod'

// Define entity
@f.entity('users')
class UserEntity {
  @f.id()
  id?: string
  
  @f.property({ required: true })
  name: string
  
  @f.property({ required: true })
  email: string
  
  @f.created()
  createdAt?: Date
}

// Define schema
const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date().optional()
})

// Create PouchDB instance
const db = new PouchDB('users')

// Initialize connector
const users = new PouchDBConnector({
  entity: UserEntity,
  dataSource: db,
  inputSchema: UserSchema
})

// Use Fluent API
const user = await users.insert({ 
  name: 'John Doe', 
  email: 'john@example.com' 
})

// Query data
const found = await users.findMany({
  where: { email: { equals: 'john@example.com' } },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})

// Sync with CouchDB
db.sync('http://localhost:5984/users', {
  live: true,
  retry: true
})
```

## Key Features

- **Offline-First** - Works without internet connection
- **Automatic Sync** - Bidirectional replication with CouchDB
- **Unified Fluent API** - Same query interface as other Fluent connectors
- **Schema Validation** - Input/output validation with Zod
- **Multiple Adapters** - IndexedDB, WebSQL, LevelDB, and in-memory
- **Conflict Resolution** - Built-in handling for sync conflicts
- **Raw Access** - Direct PouchDB database access via `.raw()` method

## Documentation

For comprehensive documentation, see the [Fluent PouchDB docs](https://docs.goatlab.io/0.1.x/connectors/pouchdb.html).

## License

MIT
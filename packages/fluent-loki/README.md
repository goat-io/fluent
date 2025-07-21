# @goatlab/fluent-loki

LokiJS connector for the Goat Fluent query interface. Provides in-memory database capabilities with multiple storage adapters including IndexedDB, file system, and encrypted storage.

## Installation

```bash
npm install @goatlab/fluent-loki
# or
yarn add @goatlab/fluent-loki
# or
pnpm add @goatlab/fluent-loki
```

## Usage

```typescript
import { Loki, LokiConnector, LokiStorageType } from '@goatlab/fluent-loki'
import { z } from 'zod'

// Define your schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number()
})

// Create LokiJS database instance
const db = Loki.createDb({
  dbName: 'myapp',
  storage: LokiStorageType.memory // or indexedDB, file, fsStructured, cryptedFile
})

// Create a User entity
class User {
  static name = 'User'
}

// Initialize the connector
const userConnector = new LokiConnector({
  entity: User,
  dataSource: db,
  inputSchema: UserSchema,
  outputSchema: UserSchema
})

// Use the Fluent query interface
const users = await userConnector.findMany({
  where: {
    age: { gte: 18 }
  },
  orderBy: [{ name: 'asc' }],
  limit: 10
})
```

## Key Features

- **Multiple Storage Adapters**: Memory, IndexedDB, file system, structured file system, and encrypted file storage
- **Fluent Query Interface**: Chainable query methods compatible with Goat Fluent
- **Schema Validation**: Built-in Zod schema validation for input and output
- **TypeScript Support**: Full type safety with generics
- **Automatic ID Generation**: UUID-based ID generation for new records
- **Pagination Support**: Built-in pagination with offset and limit
- **Complex Queries**: Support for AND/OR conditions, nested properties, and various operators
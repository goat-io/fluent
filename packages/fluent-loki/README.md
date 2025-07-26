# @goatlab/fluent-loki

LokiJS connector for Goat Fluent - a fast, in-memory database adapter with optional persistence.

## Installation

```bash
npm install @goatlab/fluent-loki
```

## Basic Usage

```typescript
import { Loki, LokiConnector, LokiStorageType } from '@goatlab/fluent-loki'
import { z } from 'zod'

// Define schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
})

// Create database
const db = Loki.createDb({
  dbName: 'myapp',
  storage: LokiStorageType.memory
})

// Create connector
const users = new LokiConnector({
  entity: { name: 'User' },
  dataSource: db,
  inputSchema: UserSchema,
  outputSchema: UserSchema
})

// Use Fluent API
const user = await users.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
})

const results = await users.findMany({
  where: { age: { gte: 18 } },
  orderBy: [{ name: 'asc' }],
  limit: 10
})
```

## Key Features

- **In-Memory Performance** - Lightning-fast operations ideal for testing and prototyping
- **Multiple Storage Options** - Memory, IndexedDB, file system, and encrypted storage
- **Fluent Query Interface** - Compatible with all Goat Fluent query patterns
- **Schema Validation** - Built-in Zod validation for type safety
- **Complex Queries** - Support for nested properties, AND/OR conditions, regex
- **Change Tracking** - Monitor document changes with event listeners
- **No External Dependencies** - Pure JavaScript implementation

## License

MIT
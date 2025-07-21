# @goatlab/fluent-formio

A fluent query interface connector for Form.io that provides a consistent API for CRUD operations with Form.io data sources. Currently includes a mock in-memory implementation for testing and development.

## Installation

```bash
npm install @goatlab/fluent-formio
# or
yarn add @goatlab/fluent-formio
# or
pnpm add @goatlab/fluent-formio
```

## Basic Usage

```typescript
import { FormioConnector } from '@goatlab/fluent-formio'

// Define your entity types
interface User {
  id?: string
  name: string
  email: string
  age: number
}

// Create a connector instance
const userConnector = new FormioConnector<User>({
  baseEndPoint: 'http://localhost:3001/users',
  token: 'your-formio-token' // optional
})

// Insert a single record
const user = await userConnector.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
})

// Find records with fluent query syntax
const adults = await userConnector.findMany({
  where: { age: { greaterOrEqualThan: 18 } },
  orderBy: [{ age: 'desc' }],
  limit: 10
})

// Find by ID
const foundUser = await userConnector.findById(user.id)

// Update a record
await userConnector.updateById(user.id, {
  age: 31
})
```

## Key Features

- **Fluent Query Interface** - Chain methods for complex queries with TypeScript support
- **Form.io Compatible** - Designed to work with Form.io REST APIs
- **In-Memory Mock Storage** - Built-in mock implementation for testing
- **Type-Safe** - Full TypeScript support with generic types
- **Standard CRUD Operations** - insert, findById, findMany, updateById, deleteById
- **Advanced Queries** - Support for where clauses, ordering, pagination
- **Batch Operations** - insertMany for bulk inserts
- **Utility Methods** - findFirst, requireById, requireFirst, pluck
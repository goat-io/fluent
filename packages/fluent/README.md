# @goatlab/fluent

A TypeScript query builder and ORM wrapper that provides a fluent interface for multiple database types with built-in validation using Zod schemas.

## Installation

```bash
npm install @goatlab/fluent
# or
yarn add @goatlab/fluent
# or
pnpm add @goatlab/fluent
```

## Basic Usage

```typescript
import { TypeOrmConnector, f } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// Define your entity
@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  name: string

  @f.property({ type: 'int' })
  age?: number

  @f.created()
  created?: Date
}

// Define your schema
const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().optional(),
  created: z.date().optional()
})

// Create a repository
class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: UserSchema
    })
  }
}

// Use the repository
const userRepo = new UserRepository(dataSource)

// Insert data
const user = await userRepo.insert({ name: 'John', age: 25 })

// Query data
const users = await userRepo.findMany({
  where: { age: { $gte: 18 } },
  orderBy: { name: 'asc' },
  limit: 10
})

// Find by ID
const user = await userRepo.findById('user-id')

// Update
await userRepo.updateById('user-id', { name: 'Jane' })

// Delete
await userRepo.deleteById('user-id')
```

## Key Features

- **Multi-database support** - Works with MySQL, PostgreSQL, MongoDB, SQLite, and more via TypeORM
- **Fluent query interface** - Chainable query methods with TypeScript support
- **Built-in validation** - Automatic input/output validation using Zod schemas
- **Decorators** - Simple entity definition using decorators (`@f.entity`, `@f.property`, etc.)
- **Type safety** - Full TypeScript support with proper type inference
- **Relations** - Support for complex relationships between entities
- **Pagination** - Built-in pagination support
- **Raw queries** - Execute raw SQL when needed

## Supported Databases

All databases supported by TypeORM:
- MySQL / MariaDB
- PostgreSQL
- MongoDB
- SQLite
- Microsoft SQL Server
- Oracle
- CockroachDB
- SAP Hana
- And more...

# @goatlab/fluent

A TypeScript query builder and ORM wrapper that provides a fluent interface for multiple database types. Built on TypeORM with Zod validation, it offers a unified query syntax across SQL and NoSQL databases with proper type preservation and nested object support.

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

// Create a repository with DataSource or getter function
class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource | (() => DataSource)) {
    super({
      entity: User,
      dataSource, // Now supports both DataSource and getter functions
      inputSchema: UserSchema
    })
  }
}

// Use the repository
const userRepo = new UserRepository(dataSource)
// or with a getter function for lazy initialization
const userRepo = new UserRepository(() => getDataSource())

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

- **Unified Query Interface** - Consistent API across MongoDB, MySQL, PostgreSQL, SQLite
- **TypeORM Integration** - Built on the proven TypeORM foundation
- **Fluent API** - Intuitive chainable query builder with full TypeScript support
- **Zod Validation** - Automatic input/output validation with Zod schemas
- **Decorator-based Models** - Simple entity definition using decorators
- **Type Safety** - Complete type inference and preservation, even in nested queries
- **Relations** - Full support for One-to-Many, Many-to-One, Many-to-Many relationships
- **Advanced Queries** - Complex conditions, aggregations, and raw SQL support
- **Lazy Initialization** - DataSource getter functions for flexible initialization
- **Extensible** - Base classes for building custom connectors

## Advanced Features

### Nested Object Queries with Dot Notation (MongoDB)

MongoDB now fully supports nested object queries using dot notation, with proper type preservation:

```typescript
// Define nested entity structure
export class Address {
  @f.property({ required: true, type: 'varchar' })
  street: string

  @f.property({ required: true, type: 'varchar' })
  city: string

  @f.property({ required: false, type: 'int' })
  zipCode?: number
}

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  name: string

  @f.embed(Address)
  address?: Address
}

// Query nested fields with dot notation
const users = await userRepo.findMany({
  where: {
    'address.city': 'New York',
    'address.zipCode': { $gte: 10000 }
  }
})

// Nested queries preserve types correctly
const users = await userRepo.findMany({
  where: {
    'profile.settings.notifications': true, // boolean preserved
    'profile.settings.maxItems': { $gte: 5 } // number preserved
  }
})
```

### MongoDB-Specific Behaviors

MongoDB has some specific behaviors that are properly handled:

1. **CreateDateColumn**: In MongoDB, `@f.created()` fields always use the current timestamp regardless of any provided value during insertion. This is a TypeORM MongoDB driver behavior.

```typescript
// MongoDB will ignore the provided created date and use current timestamp
await repo.insert({ 
  name: 'Test',
  created: new Date('2020-01-01') // This will be ignored in MongoDB
})
```

2. **Optimized Simple Queries**: Simple queries without OR/AND operators now use a more efficient query structure in MongoDB.

### Lazy DataSource Initialization

The TypeORM connector now supports DataSource getter functions, useful for scenarios where the DataSource might not be immediately available:

```typescript
// Traditional approach
const repo = new UserRepository(dataSource)

// With getter function (lazy initialization)
const repo = new UserRepository(() => container.get(DataSource))

// The DataSource is only accessed when needed
```

### Type Preservation in Queries

The query builder now properly preserves types when flattening nested objects, ensuring that:
- Numbers remain numbers (not converted to strings)
- Booleans remain booleans
- Arrays are properly handled
- Dates are correctly processed

## Supported Databases

All databases supported by TypeORM:
- MySQL / MariaDB
- PostgreSQL
- MongoDB (with full dot notation support)
- SQLite
- Microsoft SQL Server
- Oracle
- CockroachDB
- SAP Hana
- And more...

## Testing

The package includes comprehensive test suites that run identically across all supported databases:

```bash
# Run all tests
pnpm test

# Run specific database tests
pnpm test:sqlite
pnpm test:mysql
pnpm test:mongodb
pnpm test:postgresql

# Run all database tests concurrently
pnpm test:db:concurrent
```

## Migration from Previous Versions

### Breaking Changes in v0.8.0

1. **Test Framework**: Migrated from Jest to Vitest. Update your test configurations accordingly.

2. **MongoDB Nested Queries**: The query builder now properly handles dot notation for nested objects. Review your MongoDB queries to ensure they use the correct syntax.

3. **DataSource Parameter**: The `dataSource` parameter in TypeOrmConnector now accepts both `DataSource` and `() => DataSource` types.

## Documentation

For comprehensive documentation, please see the [docs directory](../../docs/). Key sections include:

- [Getting Started Guide](../../docs/getting-started/first-steps.md)
- [Query Builder Reference](../../docs/query-builder/overview.md) 
- [TypeORM Connector Guide](../../docs/connectors/typeorm.md)
- [API Reference](../../docs/api/fluent-api.md)

## License

MIT

# @goatlab/fluent API Documentation

## Table of Contents
- [TypeOrmConnector](#typeormconnector)
- [Decorators](#decorators)
- [Query Interface](#query-interface)
- [MongoDB-Specific Features](#mongodb-specific-features)
- [Advanced Usage](#advanced-usage)

## TypeOrmConnector

The main class for creating database repositories with Fluent.

### Constructor

```typescript
constructor(params: TypeOrmConnectorParams<InputDTO, OutputDTO>)
```

#### Parameters

- `entity`: The TypeORM entity class
- `dataSource`: `DataSource | (() => DataSource)` - TypeORM DataSource or a getter function
- `inputSchema`: Zod schema for input validation
- `outputSchema?`: Optional Zod schema for output validation (defaults to inputSchema)

### Example

```typescript
import { TypeOrmConnector, f } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  name: string
}

const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string()
})

class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource | (() => DataSource)) {
    super({
      entity: User,
      dataSource,
      inputSchema: UserSchema
    })
  }
}
```

## Decorators

### @f.entity(name: string)

Marks a class as a database entity.

```typescript
@f.entity('users')
class User {
  // ...
}
```

### @f.id()

Marks a property as the primary key. Automatically generates IDs if not provided.

```typescript
@f.id()
id: string
```

### @f.property(options)

Defines a regular property with various options.

```typescript
@f.property({ 
  required: true, 
  type: 'varchar',
  length: 255,
  unique: true
})
email: string

@f.property({ 
  type: 'int',
  nullable: true
})
age?: number
```

### @f.created()

Automatically sets creation timestamp.

```typescript
@f.created()
createdAt?: Date
```

**Note**: In MongoDB, this always uses the current timestamp regardless of any provided value.

### @f.updated()

Automatically updates timestamp on modifications.

```typescript
@f.updated()
updatedAt?: Date
```

### @f.embed(Class)

Embeds a nested object structure.

```typescript
class Address {
  @f.property({ required: true, type: 'varchar' })
  street: string

  @f.property({ required: true, type: 'varchar' })
  city: string
}

@f.entity('users')
class User {
  @f.embed(Address)
  address?: Address
}
```

### @f.stringArray(options)

Defines an array of strings.

```typescript
@f.stringArray({ required: true })
tags: string[]
```

## Query Interface

### findMany(query?: FluentQuery)

Find multiple records with optional filtering, sorting, and pagination.

```typescript
const users = await userRepo.findMany({
  where: {
    age: { $gte: 18 },
    name: { $regexp: '^John' }
  },
  orderBy: {
    created: 'DESC',
    name: 'ASC'
  },
  select: {
    id: true,
    name: true,
    email: true
  },
  limit: 10,
  offset: 20
})
```

### findFirst(query?: FluentQuery)

Find the first record matching the query.

```typescript
const user = await userRepo.findFirst({
  where: { email: 'john@example.com' }
})
```

### findById(id: string, query?: FluentQuery)

Find a record by its ID.

```typescript
const user = await userRepo.findById('user-id', {
  select: {
    id: true,
    name: true,
    profile: {
      bio: true
    }
  }
})
```

### findByIds(ids: string[], query?: FluentQuery)

Find multiple records by their IDs.

```typescript
const users = await userRepo.findByIds(['id1', 'id2', 'id3'])
```

### insert(data: InputDTO)

Insert a new record.

```typescript
const user = await userRepo.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 25
})
```

### insertMany(data: InputDTO[])

Insert multiple records.

```typescript
const users = await userRepo.insertMany([
  { name: 'John', age: 25 },
  { name: 'Jane', age: 30 }
])
```

### updateById(id: string, data: Partial<InputDTO>)

Update a record by ID.

```typescript
await userRepo.updateById('user-id', {
  name: 'Jane Doe',
  age: 26
})
```

### deleteById(id: string)

Delete a record by ID.

```typescript
await userRepo.deleteById('user-id')
```

### count(query?: FluentQuery)

Count records matching the query.

```typescript
const count = await userRepo.count({
  where: { age: { $gte: 18 } }
})
```

### paginate(query?: FluentQuery & { page?: number, pageSize?: number })

Get paginated results.

```typescript
const result = await userRepo.paginate({
  where: { status: 'active' },
  page: 2,
  pageSize: 20
})
// Returns: { data: User[], total: number, page: number, pageSize: number }
```

## Query Operators

### Comparison Operators

- `$eq`: Equal to (default when value is provided directly)
- `$ne`: Not equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal to
- `$lt`: Less than
- `$lte`: Less than or equal to

```typescript
where: {
  age: { $gte: 18 },
  status: { $ne: 'deleted' },
  score: { $gt: 80 }
}
```

### Array Operators

- `$in`: Value is in array
- `$nin`: Value is not in array

```typescript
where: {
  status: { $in: ['active', 'pending'] },
  role: { $nin: ['admin', 'superadmin'] }
}
```

### Existence Operators

- `$exists`: Field exists
- `$notExists`: Field does not exist

```typescript
where: {
  deletedAt: { $notExists: true },
  metadata: { $exists: true }
}
```

### Pattern Matching

- `$regexp`: Regular expression matching

```typescript
where: {
  email: { $regexp: '@company\\.com$' },
  name: { $regexp: '^John' }
}
```

### Logical Operators

- `OR`: Logical OR
- `AND`: Logical AND

```typescript
where: {
  OR: [
    { age: { $gte: 65 } },
    { status: 'vip' }
  ],
  AND: [
    { active: true },
    { verified: true }
  ]
}
```

## MongoDB-Specific Features

### Dot Notation for Nested Objects

MongoDB supports querying nested objects using dot notation:

```typescript
// Query nested fields directly
const users = await userRepo.findMany({
  where: {
    'address.city': 'New York',
    'address.zipCode': { $gte: 10000 },
    'profile.settings.notifications': true
  }
})
```

### Optimized Simple Queries

Simple queries without OR/AND operators are automatically optimized:

```typescript
// This query uses an optimized structure in MongoDB
const users = await userRepo.findMany({
  where: {
    status: 'active',
    age: { $gte: 18 }
  }
})
```

### BSON ObjectID Handling

String IDs are automatically converted to BSON ObjectIDs:

```typescript
// These IDs are automatically converted to ObjectID
const user = await userRepo.findById('507f1f77bcf86cd799439011')
const users = await userRepo.findByIds([
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012'
])
```

## Advanced Usage

### Lazy DataSource Initialization

Use a getter function when the DataSource isn't immediately available:

```typescript
// With dependency injection container
class UserRepository extends TypeOrmConnector<User> {
  constructor(private container: Container) {
    super({
      entity: User,
      dataSource: () => container.get(DataSource),
      inputSchema: UserSchema
    })
  }
}

// With async initialization
let dataSourcePromise: Promise<DataSource>

class UserRepository extends TypeOrmConnector<User> {
  constructor() {
    super({
      entity: User,
      dataSource: () => {
        if (!dataSourcePromise) {
          dataSourcePromise = createDataSource()
        }
        return dataSourcePromise
      },
      inputSchema: UserSchema
    })
  }
}
```

### Complex Nested Queries

Query deeply nested structures with type safety:

```typescript
const users = await userRepo.findMany({
  where: {
    'profile.preferences.theme': 'dark',
    'profile.stats.loginCount': { $gte: 10 },
    'settings.notifications.email.marketing': false
  },
  select: {
    id: true,
    name: true,
    profile: {
      preferences: {
        theme: true,
        language: true
      }
    }
  }
})
```

### Custom Validation with Zod

Leverage Zod schemas for complex validation:

```typescript
const UserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  age: z.number().min(0).max(150),
  role: z.enum(['user', 'admin', 'moderator']),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).max(10),
  profile: z.object({
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional()
  }).optional()
})
```

### Raw Queries

Execute raw queries when needed:

```typescript
// SQL databases
const results = await userRepo.query(
  'SELECT * FROM users WHERE age > $1',
  [18]
)

// MongoDB
const results = await userRepo.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: '$role', count: { $sum: 1 } } }
])
```

## Best Practices

1. **Always define Zod schemas** for input validation
2. **Use select to limit fields** returned from queries
3. **Leverage indexes** for frequently queried fields
4. **Use transactions** for complex operations
5. **Handle MongoDB-specific behaviors** appropriately
6. **Use dot notation** for nested queries in MongoDB
7. **Prefer lazy DataSource initialization** in dependency injection scenarios

## TypeScript Support

The library provides full TypeScript support with:
- Type inference for entities
- Type-safe query builders
- Zod schema integration
- Proper generic constraints
- IDE autocomplete support

```typescript
// Full type inference
const user = await userRepo.findById('id') // user is typed as User | null

// Type-safe queries
const users = await userRepo.findMany({
  where: {
    age: { $gte: 18 }, // TypeScript knows age is a number
    // @ts-expect-error - TypeScript catches invalid fields
    invalidField: 'value'
  }
})
```
# Fluent Query Builder Reference

The **Fluent Query Builder** is the core of @goatlab/fluent, providing a unified, type-safe interface for database operations across SQL and NoSQL databases. Built on TypeORM, it offers a consistent API that works identically whether you're using PostgreSQL, MySQL, MongoDB, or SQLite.

## 🎯 What is the Query Builder?

The Query Builder is a **TypeScript-first database abstraction layer** that provides:

- **Unified Query Syntax** - Same API for SQL and NoSQL databases
- **MongoDB-style Operators** - Familiar `$gte`, `$in`, `$or` operators work everywhere
- **Type Safety** - Full TypeScript support with compile-time validation
- **Zod Validation** - Automatic input/output validation
- **Nested Object Queries** - Dot notation support for MongoDB
- **Relationship Management** - One-to-Many, Many-to-Many, embeddings
- **Lazy Loading** - DataSource getter functions for flexible initialization

## 🏗️ Architecture

Fluent follows a **connector pattern** with these layers:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Your Code     │───▶│ FluentConnector │───▶│ BaseConnector   │
│   Repository    │    │   Interface     │    │ (Abstract Base) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ TypeOrmConnector│
                                              │ (Concrete Impl) │  
                                              └─────────────────┘
                                                        │
                       ┌────────────────────────────────┴────────────────────────────────┐
                       ▼                    ▼                    ▼                      ▼
                ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                │    MySQL    │    │ PostgreSQL  │    │   MongoDB   │    │   SQLite    │
                │  (TypeORM)  │    │  (TypeORM)  │    │  (TypeORM)  │    │  (TypeORM)  │
                └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 🔧 Core Components

### 1. **TypeOrmConnector** 
The main connector extending BaseConnector:
```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { DataSource } from 'typeorm'

export class UserRepository extends TypeOrmConnector<User> {
  constructor(dataSource: DataSource | (() => DataSource)) {
    super({
      entity: User,
      dataSource,
      inputSchema: UserSchema
    })
  }
}
```

### 2. **FluentQuery Interface**
Unified query structure for all databases:
```typescript
interface FluentQuery<T> {
  where?: WhereConditions<T>
  select?: SelectFields<T>
  include?: IncludeRelations<T>
  orderBy?: OrderByFields<T>
  limit?: number
  offset?: number
}
```

### 3. **MongoDB-style Operators**
Consistent operators across all databases:
```typescript
// These work in MySQL, PostgreSQL, MongoDB, and SQLite!
const query = {
  where: {
    age: { $gte: 18 },
    status: { $in: ['active', 'pending'] },
    $or: [
      { role: 'admin' },
      { permissions: { $contains: 'write' } }
    ]
  }
}
```

### 4. **Decorator System**
Simple entity definition with decorators:
```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  name: string

  @f.property({ type: 'int' })
  age?: number

  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts?: Post[]
}
```

## 🎨 Key Features

### **Unified Query Syntax**
Same query works across all databases:
```typescript
// This exact query works in MySQL, PostgreSQL, MongoDB, and SQLite!
const users = await userRepo.findMany({
  where: {
    age: { $gte: 18 },
    status: 'active',
    $or: [
      { role: 'admin' },
      { department: { $in: ['IT', 'HR'] } }
    ]
  },
  orderBy: { createdAt: 'desc' },
  limit: 10
})
```

### **Type Safety with Zod**
Automatic validation on all operations:
```typescript
const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150)
})

// This will throw validation error
try {
  await userRepo.insert({
    name: '',  // Too short!
    email: 'invalid-email',  // Invalid format!
    age: 200  // Too old!
  })
} catch (error) {
  console.error('Validation failed:', error)
}
```

### **Nested Object Queries (MongoDB)**
Dot notation with proper type preservation:
```typescript
// Define nested structure
@f.entity('users')
class User {
  @f.embed(Address)
  address?: Address
  
  @f.embed(Settings)
  settings?: Settings
}

// Query nested fields
const nyUsers = await userRepo.findMany({
  where: {
    'address.city': 'New York',
    'address.zipCode': { $gte: 10000 },
    'settings.notifications.email': true
  }
})
```

### **Advanced Relations**
Complex relationships made simple:
```typescript
// One-to-Many
@f.hasMany({ entity: () => Post, inverse: 'author' })
posts?: Post[]

// Many-to-One  
@f.belongsTo({ entity: () => User, inverse: 'posts', pivotColumnName: 'authorId' })
author: User

// Many-to-Many
@f.belongsToMany({ 
  entity: () => Tag, 
  joinTableName: 'post_tags',
  foreignKey: 'postId',
  inverseForeignKey: 'tagId'
})
tags?: Tag[]

// Load with relations
const post = await postRepo.findById(id, {
  include: { 
    author: true,
    tags: true,
    comments: {
      include: { user: true }
    }
  }
})
```

## 🔄 Query Builder Methods

### **Core CRUD Operations**
```typescript
// CREATE
const user = await userRepo.insert({ name: 'John', email: 'john@example.com' })
const users = await userRepo.insertMany([...])

// READ
const user = await userRepo.findById(id)
const users = await userRepo.findByIds([id1, id2])
const user = await userRepo.findFirst({ where: { email: 'john@example.com' } })
const users = await userRepo.findMany({ where: { active: true } })

// UPDATE
const updated = await userRepo.updateById(id, { name: 'Jane' })
const replaced = await userRepo.replaceById(id, fullUserObject)

// DELETE
await userRepo.deleteById(id)

// REQUIRE (throws if not found)
const user = await userRepo.requireById(id)
const user = await userRepo.requireFirst({ where: { email: 'admin@example.com' } })
```

### **Query Options**
```typescript
interface FluentQuery<T> {
  // Filter conditions
  where?: {
    // Direct equality
    field: value
    
    // Operators
    field: {
      $eq?: value      // Equal
      $ne?: value      // Not equal  
      $gt?: value      // Greater than
      $gte?: value     // Greater than or equal
      $lt?: value      // Less than
      $lte?: value     // Less than or equal
      $in?: value[]    // In array
      $nin?: value[]   // Not in array
      $like?: string   // SQL LIKE
      $ilike?: string  // Case-insensitive LIKE
      $contains?: value // Array/JSON contains
      $between?: [min, max] // Between values
    }
    
    // Logical operators
    $and?: WhereCondition[]
    $or?: WhereCondition[]
    $not?: WhereCondition
  }
  
  // Field selection
  select?: {
    field1: true
    field2: true
    // Nested selection
    relation: {
      nestedField: true
    }
  }
  
  // Include relations
  include?: {
    relation1: true
    relation2: {
      // Nested includes
      include: { 
        nestedRelation: true 
      }
      // Filter included data
      where?: WhereCondition
      // Select fields from relation
      select?: SelectFields
    }
  }
  
  // Sorting
  orderBy?: {
    field1: 'asc' | 'desc'
    field2: 'asc' | 'desc'
  }
  
  // Pagination
  limit?: number
  offset?: number
}
```

## 🚀 Advanced Examples

### **Complex Query with Relations**
```typescript
// Find active users with their recent posts and comments
const activeUsers = await userRepo.findMany({
  where: {
    status: 'active',
    lastLoginAt: { $gte: new Date('2024-01-01') }
  },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      limit: 5,
      include: {
        comments: {
          include: { author: true }
        }
      }
    }
  },
  orderBy: { lastLoginAt: 'desc' },
  limit: 20
})
```

### **Aggregation-style Queries**
```typescript
// Get users grouped by department with counts
const usersByDept = await userRepo.findMany()
const grouped = usersByDept.reduce((acc, user) => {
  acc[user.department] = (acc[user.department] || 0) + 1
  return acc
}, {})

// Or use with Collection utilities
import { Collection } from '@goatlab/js-utils'
const collection = new Collection(usersByDept)
const deptStats = collection
  .groupBy('department')
  .map((users, dept) => ({
    department: dept,
    count: users.length,
    avgAge: users.reduce((sum, u) => sum + u.age, 0) / users.length
  }))
```

### **Transaction Support**
```typescript
const dataSource = AppDataSource

await dataSource.transaction(async manager => {
  const userRepo = new UserRepository(() => manager)
  const postRepo = new PostRepository(() => manager)
  
  const user = await userRepo.insert({ name: 'John' })
  await postRepo.insert({ 
    title: 'First Post',
    authorId: user.id 
  })
})
```

### **Raw SQL When Needed**
```typescript
// Execute raw queries when needed
const results = await userRepo.raw()
  .query('SELECT * FROM users WHERE age > $1', [18])

// Or use query builder
const qb = userRepo.raw()
  .createQueryBuilder('user')
  .where('user.age > :age', { age: 18 })
  .getMany()
```

## 🎯 Next Steps

1. **[Quickstart Guide](../getting-started/fluent-quickstart.md)** - Get up and running fast
2. **[TypeORM Connector](../connectors/typeorm.md)** - Deep dive into the main connector
3. **[Decorators Reference](../core/decorators.md)** - All available decorators
4. **[MongoDB Queries](../examples/nosql-queries.md)** - NoSQL-specific features
5. **[Relations Guide](../examples/relations.md)** - Master relationships

## 💡 Best Practices

1. **Always define Zod schemas** for input validation
2. **Use typed repositories** instead of generic connectors
3. **Leverage TypeScript** for compile-time safety
4. **Keep queries simple** - complex logic belongs in the service layer
5. **Use transactions** for multi-step operations
6. **Index your queries** - add database indexes for where conditions

The Fluent Query Builder brings the simplicity of MongoDB queries to all databases while maintaining full type safety and validation. It's the foundation for building robust, database-agnostic applications.
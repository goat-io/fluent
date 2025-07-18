# TypeORM Connector

The TypeORM Connector is the primary database connector in Fluent, providing support for multiple SQL and NoSQL databases through TypeORM integration. It extends the BaseConnector to offer comprehensive database operations with type safety and automatic query optimization.

## Overview

The TypeORM Connector provides:
- **Multi-Database Support**: MySQL, PostgreSQL, SQLite, MongoDB, and more
- **Type Safety**: Full TypeScript integration with compile-time validation
- **Relationship Management**: Automatic handling of complex data relationships
- **Query Optimization**: Built-in caching and query optimization
- **Schema Validation**: Input/output validation with Zod schemas
- **Migration Support**: Database schema versioning and migrations

## Basic Usage

### Setup

```typescript
import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '@goatlab/fluent'
import { User } from './entities/User'
import { CreateUserSchema, UserSchema } from './schemas/user.schema'

// Create data source
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User],
  synchronize: false,
  logging: true
})

// Create repository
class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: CreateUserSchema,
      outputSchema: UserSchema
    })
  }
}

// Initialize
await Fluent.initialize([dataSource], [User])
const userRepo = new UserRepository(dataSource)
```

## Constructor Parameters

The TypeORM Connector accepts the following parameters:

```typescript
interface TypeOrmConnectorParams<Input, Output> {
  entity: any                    // TypeORM entity class
  dataSource: DataSource         // TypeORM data source
  inputSchema: z.ZodType<Input>  // Zod schema for input validation
  outputSchema?: z.ZodType<Output> // Zod schema for output validation
}
```

### Parameter Details

- **entity**: The TypeORM entity class that defines the database table structure
- **dataSource**: The configured TypeORM DataSource instance
- **inputSchema**: Zod schema for validating input data (inserts/updates)
- **outputSchema**: Optional Zod schema for validating output data (defaults to inputSchema)

## CRUD Operations

### Create Operations

```typescript
// Insert single record
const user = await userRepo.insert({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30
})

// Insert multiple records
const users = await userRepo.insertMany([
  { email: 'john@example.com', name: 'John Doe', age: 30 },
  { email: 'jane@example.com', name: 'Jane Smith', age: 25 }
])
```

### Read Operations

```typescript
// Find by ID
const user = await userRepo.findById('user-id')

// Find first matching record
const user = await userRepo.findFirst({
  where: { email: 'john@example.com' }
})

// Find multiple records
const users = await userRepo.findMany({
  where: { isActive: true },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})

// Require record (throws error if not found)
const user = await userRepo.requireById('user-id')
const user = await userRepo.requireFirst({
  where: { email: 'john@example.com' }
})
```

### Update Operations

```typescript
// Update by ID
const updatedUser = await userRepo.updateById('user-id', {
  name: 'John Smith',
  age: 31
})

// Update multiple records
const updatedUsers = await userRepo.updateMany(
  { isActive: false }, // where conditions
  { lastLoginAt: new Date() } // update data
)
```

### Delete Operations

```typescript
// Delete by ID
await userRepo.deleteById('user-id')

// Delete multiple records
await userRepo.deleteMany({
  where: { isActive: false }
})

// Soft delete (if entity supports it)
await userRepo.softDelete('user-id')
```

## Advanced Query Features

### Complex Where Conditions

```typescript
// Nested conditions with logical operators
const users = await userRepo.findMany({
  where: {
    AND: [
      { isActive: true },
      {
        OR: [
          { age: { gte: 18 } },
          { hasParentalConsent: true }
        ]
      }
    ]
  }
})

// Relationship conditions
const users = await userRepo.findMany({
  where: {
    posts: {
      createdAt: { gte: new Date('2024-01-01') },
      status: 'published'
    }
  }
})
```

### Relationship Loading

```typescript
// Include related data
const users = await userRepo.findMany({
  include: {
    posts: {
      select: {
        id: true,
        title: true,
        createdAt: true
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: 5
    },
    profile: true,
    roles: {
      withPivot: true // Include pivot table data
    }
  }
})
```

### Aggregations and Collections

```typescript
// Count records
const totalUsers = await userRepo.count()
const activeUsers = await userRepo.count({
  where: { isActive: true }
})

// Use collections for advanced operations
const userCollection = await userRepo.collect({
  where: { isActive: true }
})

const stats = {
  averageAge: userCollection.avg('age'),
  maxAge: userCollection.max('age'),
  totalUsers: userCollection.count(),
  uniqueRoles: userCollection.pluck('role').unique()
}
```

## Database-Specific Features

### MySQL

```typescript
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User],
  synchronize: false,
  logging: true,
  // MySQL-specific options
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl: {
    rejectUnauthorized: false
  }
})

// MySQL-specific queries
const users = await userRepo.findMany({
  where: {
    [Symbol.for('raw')]: {
      condition: 'YEAR(created_at) = ?',
      parameters: [2024]
    }
  }
})
```

### PostgreSQL

```typescript
const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User],
  synchronize: false,
  logging: true,
  // PostgreSQL-specific options
  schema: 'public',
  ssl: process.env.NODE_ENV === 'production'
})

// PostgreSQL-specific features
const users = await userRepo.findMany({
  where: {
    metadata: {
      '@>': JSON.stringify({ verified: true }) // JSONB contains
    }
  }
})
```

### MongoDB

```typescript
const dataSource = new DataSource({
  type: 'mongodb',
  url: 'mongodb://localhost:27017/your_database',
  entities: [User],
  synchronize: true,
  logging: true
})

// MongoDB-specific queries
const users = await userRepo.findMany({
  where: {
    tags: { $in: ['javascript', 'typescript'] },
    'profile.score': { $gte: 100 }
  }
})
```

### SQLite

```typescript
const dataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  entities: [User],
  synchronize: true,
  logging: true
})

// SQLite works with standard queries
const users = await userRepo.findMany({
  where: { isActive: true },
  orderBy: [{ createdAt: 'desc' }]
})
```

## Relationship Management

### One-to-Many Relationships

```typescript
class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  // Define relationship method
  posts() {
    return this.hasMany({
      repository: PostRepository,
      entity: () => Post
    })
  }
}

// Usage
const userRepo = new UserRepository(dataSource)
const postRepo = userRepo.posts()

// Associate posts with a user
await userRepo.findMany({ where: { id: 'user-id' } })
  .then(users => {
    return postRepo.associate({
      title: 'New Post',
      content: 'Post content...'
    })
  })
```

### Many-to-Many Relationships

```typescript
class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  roles() {
    return this.belongsToMany({
      repository: RoleRepository,
      entity: () => Role,
      pivot: UserRoleRepository
    })
  }
}

// Usage
const userRepo = new UserRepository(dataSource)
const roleRepo = userRepo.roles()

// Attach roles to users
await userRepo.findMany({ where: { id: 'user-id' } })
  .then(users => {
    return roleRepo.attach('role-id', {
      assignedAt: new Date(),
      assignedBy: 'admin-id'
    })
  })
```

### Belongs-to Relationships

```typescript
class PostRepository extends TypeOrmConnector<Post, CreatePostDTO, PostDTO> {
  author() {
    return this.belongsTo({
      repository: UserRepository,
      entity: () => User
    })
  }
}
```

## Query Optimization

### Caching

```typescript
import { Memo } from '@goatlab/js-utils'

class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  // Cache method results
  @Memo.syncMethod()
  async findActiveUsers(): Promise<UserDTO[]> {
    return await this.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }]
    })
  }
}
```

### Connection Pooling

```typescript
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  // Connection pool configuration
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
  }
})
```

### Query Optimization

```typescript
// Use indexes effectively
@Index(['email']) // Single field index
@Index(['email', 'isActive']) // Composite index
@f.entity('users')
export class User {
  @f.property({ required: true })
  email: string

  @f.property()
  isActive: boolean
}

// Efficient queries
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    name: true
  }, // Select only needed fields
  where: {
    isActive: true, // Use indexed field
    email: { like: '%@company.com' }
  },
  orderBy: [{ createdAt: 'desc' }], // Use indexed field
  limit: 10 // Always limit results
})
```

## Error Handling

### Validation Errors

```typescript
import { ValidationError } from 'class-validator'

try {
  const user = await userRepo.insert({
    email: 'invalid-email',
    name: '',
    age: -5
  })
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation errors:', error.constraints)
  }
}
```

### Database Errors

```typescript
try {
  const user = await userRepo.insert(userData)
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    console.log('Duplicate entry error')
  } else if (error.code === 'ER_NO_REFERENCED_ROW') {
    console.log('Foreign key constraint error')
  }
}
```

## Testing

### Test Setup

```typescript
import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '@goatlab/fluent'

describe('UserRepository', () => {
  let dataSource: DataSource
  let userRepo: UserRepository

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User],
      synchronize: true
    })

    await Fluent.initialize([dataSource], [User])
    userRepo = new UserRepository(dataSource)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  test('should create and find user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      age: 25
    }

    const user = await userRepo.insert(userData)
    expect(user.email).toBe(userData.email)

    const foundUser = await userRepo.findById(user.id)
    expect(foundUser).toBeDefined()
    expect(foundUser?.id).toBe(user.id)
  })
})
```

### Mock Data

```typescript
// Create test data factory
class UserFactory {
  static create(overrides: Partial<CreateUserDTO> = {}): CreateUserDTO {
    return {
      email: `user-${Date.now()}@example.com`,
      name: 'Test User',
      age: 25,
      ...overrides
    }
  }

  static async createMany(count: number, overrides: Partial<CreateUserDTO> = {}): Promise<CreateUserDTO[]> {
    return Array.from({ length: count }, (_, i) => 
      UserFactory.create({ ...overrides, email: `user-${i}@example.com` })
    )
  }
}

// Usage in tests
const users = await userRepo.insertMany(
  await UserFactory.createMany(10)
)
```

## Migration Support

### Creating Migrations

```typescript
// Generate migration
// npx typeorm migration:generate -d src/database.ts AddUserTable

// Migration file
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserTable1234567890 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        age INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`)
  }
}
```

### Running Migrations

```typescript
// Run migrations
await dataSource.runMigrations()

// Revert migrations
await dataSource.undoLastMigration()
```

## Best Practices

### 1. Use Proper Typing

```typescript
// ✅ Properly typed repository
class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: CreateUserSchema,
      outputSchema: UserSchema
    })
  }
}
```

### 2. Validate Input Data

```typescript
// ✅ Comprehensive validation schema
const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  age: z.number().min(0).max(150).optional(),
  roles: z.array(z.string()).optional()
})
```

### 3. Use Indexes

```typescript
// ✅ Add indexes to commonly queried fields
@Index(['email'])
@Index(['isActive', 'createdAt'])
@f.entity('users')
export class User {
  @f.property({ required: true })
  email: string

  @f.property()
  isActive: boolean

  @f.created()
  createdAt: Date
}
```

### 4. Handle Relationships Properly

```typescript
// ✅ Define relationships in both directions
@f.entity('users')
export class User {
  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]
}

@f.entity('posts')
export class Post {
  @f.belongsTo({ entity: () => User, inverse: 'posts', pivotColumnName: 'authorId' })
  author: User
}
```

## Performance Considerations

### Connection Management

```typescript
// Use connection pooling
const dataSource = new DataSource({
  type: 'mysql',
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
  }
})
```

### Query Optimization

```typescript
// Use specific selects
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    name: true
  },
  limit: 10
})

// Use indexes in where clauses
const users = await userRepo.findMany({
  where: {
    email: 'user@example.com', // Indexed field
    isActive: true             // Indexed field
  }
})
```

## Related Documentation

- **[Base Connector](base-connector.md)** - Understanding the base functionality
- **[Query Builder](query-builder.md)** - Advanced query patterns
- **[Entities](entities.md)** - Entity definition and relationships
- **[Decorators](decorators.md)** - Entity decorators reference

The TypeORM Connector provides a powerful, flexible way to interact with multiple database systems while maintaining type safety and performance. Its comprehensive feature set makes it suitable for everything from simple CRUD operations to complex enterprise applications.
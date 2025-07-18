# TypeORM Connector

The TypeORM connector is the primary database connector in Goat Fluent, providing support for multiple SQL and NoSQL databases including MySQL, PostgreSQL, MongoDB, SQLite, and more.

## Overview

The `TypeOrmConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, offering a unified API for database operations across different database systems.

### Supported Databases

- **MySQL** - Full SQL support with relations
- **PostgreSQL** - Full SQL support with relations  
- **MongoDB** - NoSQL support with aggregation pipelines
- **SQLite** - Lightweight SQL database
- **MariaDB** - MySQL-compatible database
- **Oracle** - Enterprise database support
- **Microsoft SQL Server** - Enterprise database support

## Installation

```bash
npm install @goatlab/fluent typeorm
```

## Basic Setup

### 1. Define Your Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity()
@ObjectType()
export class User {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @f.Column()
  email: string

  @Column()
  @f.Column()
  name: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date
}

// Define your schemas
export const UserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
})

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.date()
})
```

### 2. Create DataSource

```typescript
import { DataSource } from 'typeorm'
import { User } from './entities/User'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'myapp',
  entities: [User],
  synchronize: true, // Only for development
  logging: false
})
```

### 3. Create Repository

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { AppDataSource } from './datasource'
import { User, UserInputSchema, UserOutputSchema } from './entities/User'

export class UserRepository extends TypeOrmConnector<User, typeof UserInputSchema._type, typeof UserOutputSchema._type> {
  constructor() {
    super({
      entity: User,
      dataSource: AppDataSource,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### 4. Initialize and Use

```typescript
import { Fluent } from '@goatlab/fluent'
import { AppDataSource } from './datasource'
import { User } from './entities/User'

// Initialize Fluent
await Fluent.initialize([AppDataSource], [User])

// Create repository instance
const userRepository = new UserRepository()

// Use the repository
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe'
})
```

## Database-Specific Configurations

### MySQL Configuration

```typescript
export const MySQLDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'myapp',
  entities: [User],
  synchronize: true,
  logging: false,
  timezone: 'UTC',
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  }
})
```

### PostgreSQL Configuration

```typescript
export const PostgreSQLDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'myapp',
  entities: [User],
  synchronize: true,
  logging: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})
```

### MongoDB Configuration

```typescript
export const MongoDataSource = new DataSource({
  type: 'mongodb',
  host: 'localhost',
  port: 27017,
  database: 'myapp',
  entities: [User],
  synchronize: true,
  logging: false,
  useUnifiedTopology: true,
  authSource: 'admin',
  // Optional authentication
  username: 'admin',
  password: 'password'
})
```

### SQLite Configuration

```typescript
export const SQLiteDataSource = new DataSource({
  type: 'sqlite',
  database: './database.sqlite',
  entities: [User],
  synchronize: true,
  logging: false
})
```

## CRUD Operations

### Create

```typescript
// Insert single record
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe'
})

// Insert multiple records
const users = await userRepository.insertMany([
  { email: 'john@example.com', name: 'John Doe' },
  { email: 'jane@example.com', name: 'Jane Smith' }
])
```

### Read

```typescript
// Find all users
const users = await userRepository.findMany()

// Find with filters
const users = await userRepository.findMany({
  where: { name: { contains: 'John' } },
  orderBy: { createdAt: 'desc' },
  limit: 10
})

// Find by ID
const user = await userRepository.findById('user-id')

// Find first matching record
const user = await userRepository.findFirst({
  where: { email: 'john@example.com' }
})
```

### Update

```typescript
// Update by ID
const updatedUser = await userRepository.updateById('user-id', {
  name: 'John Updated'
})

// Update many with conditions
const updatedUsers = await userRepository.updateMany(
  { where: { name: { contains: 'John' } } },
  { name: 'Updated Name' }
)
```

### Delete

```typescript
// Delete by ID
await userRepository.deleteById('user-id')

// Delete many with conditions
await userRepository.deleteMany({
  where: { createdAt: { lt: new Date('2023-01-01') } }
})
```

## Query Building

### Basic Queries

```typescript
// Simple where conditions
const users = await userRepository.findMany({
  where: {
    email: 'john@example.com',
    name: { contains: 'Doe' }
  }
})

// Logical operators
const users = await userRepository.findMany({
  where: {
    OR: [
      { email: { contains: '@gmail.com' } },
      { email: { contains: '@yahoo.com' } }
    ]
  }
})
```

### Advanced Queries

```typescript
// Complex conditions with nested logic
const users = await userRepository.findMany({
  where: {
    AND: [
      {
        OR: [
          { email: { contains: '@gmail.com' } },
          { email: { contains: '@yahoo.com' } }
        ]
      },
      {
        createdAt: { gte: new Date('2023-01-01') }
      }
    ]
  },
  orderBy: [
    { createdAt: 'desc' },
    { name: 'asc' }
  ],
  limit: 50,
  offset: 100
})
```

### Selecting Fields

```typescript
// Select specific fields
const users = await userRepository.findMany({
  select: {
    id: true,
    email: true,
    name: true
  }
})

// Select with relations
const users = await userRepository.findMany({
  select: {
    id: true,
    email: true,
    profile: {
      id: true,
      bio: true
    }
  },
  include: {
    profile: true
  }
})
```

## Relations

### One-to-One Relations

```typescript
@Entity()
@ObjectType()
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @f.Column()
  bio: string

  @OneToOne(() => User, user => user.profile)
  @JoinColumn()
  user: User
}

// In User entity
@OneToOne(() => Profile, profile => profile.user)
@f.Column()
profile: Profile
```

### One-to-Many Relations

```typescript
@Entity()
@ObjectType()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @f.Column()
  title: string

  @ManyToOne(() => User, user => user.posts)
  author: User
}

// In User entity
@OneToMany(() => Post, post => post.author)
@f.Column()
posts: Post[]
```

### Many-to-Many Relations

```typescript
@Entity()
@ObjectType()
export class Role {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @f.Column()
  name: string

  @ManyToMany(() => User, user => user.roles)
  users: User[]
}

// In User entity
@ManyToMany(() => Role, role => role.users)
@JoinTable()
@f.Column()
roles: Role[]
```

## MongoDB-Specific Features

### Aggregation Pipelines

```typescript
// The TypeORM connector automatically handles MongoDB aggregation
const users = await userRepository.findMany({
  where: {
    posts: {
      some: {
        published: true,
        createdAt: { gte: new Date('2023-01-01') }
      }
    }
  },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' }
    }
  }
})
```

### Text Search

```typescript
// MongoDB text search
const users = await userRepository.findMany({
  where: {
    $text: { $search: 'john developer' }
  }
})
```

## Error Handling

```typescript
try {
  const user = await userRepository.insert({
    email: 'invalid-email',
    name: ''
  })
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    console.log('Validation errors:', error.errors)
  } else {
    // Handle database errors
    console.log('Database error:', error.message)
  }
}
```

## Performance Optimization

### Connection Pooling

```typescript
export const AppDataSource = new DataSource({
  type: 'mysql',
  // ... other options
  extra: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  }
})
```

### Query Optimization

```typescript
// Use select to limit fields
const users = await userRepository.findMany({
  select: {
    id: true,
    name: true
  },
  where: { active: true },
  limit: 100
})

// Use indexes for frequently queried fields
@Index(['email'])
@Index(['createdAt'])
@Entity()
export class User {
  // ... entity definition
}
```

### Batch Operations

```typescript
// Insert many records at once
const users = await userRepository.insertMany(largeUserArray)

// Update many records
await userRepository.updateMany(
  { where: { active: false } },
  { active: true }
)
```

## Migration and Schema Management

### Synchronization (Development Only)

```typescript
export const AppDataSource = new DataSource({
  // ... other options
  synchronize: true // Only for development
})
```

### Migrations (Production)

```typescript
export const AppDataSource = new DataSource({
  // ... other options
  synchronize: false,
  migrationsRun: true,
  migrations: ['src/migrations/**/*.ts'],
  cli: {
    migrationsDir: 'src/migrations'
  }
})
```

Generate migration:
```bash
npx typeorm migration:generate -n UserMigration
```

## Best Practices

1. **Always use schemas** for input/output validation
2. **Use transactions** for multi-step operations
3. **Implement proper error handling** with try-catch blocks
4. **Use connection pooling** for production applications
5. **Avoid synchronize: true** in production
6. **Use migrations** for schema changes in production
7. **Implement proper indexing** for frequently queried fields
8. **Use select** to limit returned fields when possible
9. **Implement proper logging** for debugging
10. **Use environment variables** for database configuration

## Troubleshooting

### Common Issues

1. **Connection Timeout**: Increase `acquireTimeout` in connection options
2. **Too Many Connections**: Reduce `connectionLimit` or implement connection pooling
3. **Schema Sync Issues**: Use migrations instead of synchronize in production
4. **Performance Issues**: Add proper indexes and use select clauses
5. **Memory Issues**: Implement pagination for large datasets

### Debug Mode

```typescript
export const AppDataSource = new DataSource({
  // ... other options
  logging: true,
  logger: 'advanced-console'
})
```

This will log all SQL queries and help with debugging.
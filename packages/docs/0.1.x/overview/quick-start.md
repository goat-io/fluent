# Quick Start Guide

Get up and running with Fluent in just 15 minutes! This guide will walk you through creating your first type-safe database application.

## Prerequisites

- Node.js 18+ installed
- TypeScript knowledge
- Basic database concepts

## Step 1: Installation

Install Fluent and its dependencies:

```bash
npm install @goatlab/fluent typeorm reflect-metadata zod
# or
yarn add @goatlab/fluent typeorm reflect-metadata zod
# or
pnpm add @goatlab/fluent typeorm reflect-metadata zod
```

For this example, we'll use SQLite for simplicity:

```bash
npm install sqlite3
```

## Step 2: Setup TypeScript

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Step 3: Define Your First Entity

Create a `src/entities/User.ts` file:

```typescript
import { f } from '@goatlab/fluent'

@f.entity('users')
export class User {
  @f.id()
  id: string

  @f.property({ required: true })
  email: string

  @f.property({ required: true })
  name: string

  @f.property()
  age?: number

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date

  @f.hasMany({ entity: () => Post, inverse: 'author' })
  posts: Post[]
}

@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.property({ required: true })
  title: string

  @f.property({ required: true })
  content: string

  @f.belongsTo({ entity: () => User, inverse: 'posts', pivotColumnName: 'authorId' })
  author: User

  @f.created()
  createdAt: Date

  @f.updated()
  updatedAt: Date
}
```

## Step 4: Create Validation Schemas

Create `src/schemas/user.schema.ts`:

```typescript
import { z } from 'zod'

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  age: z.number().optional()
})

export const UpdateUserSchema = CreateUserSchema.partial()

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type CreateUserDTO = z.infer<typeof CreateUserSchema>
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>
export type UserDTO = z.infer<typeof UserSchema>
```

## Step 5: Create a Repository

Create `src/repositories/UserRepository.ts`:

```typescript
import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '@goatlab/fluent'
import { User } from '../entities/User'
import { CreateUserDTO, UpdateUserDTO, UserDTO, CreateUserSchema, UserSchema } from '../schemas/user.schema'
import { PostRepository } from './PostRepository'
import { Post } from '../entities/Post'

export class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: CreateUserSchema,
      outputSchema: UserSchema
    })
  }

  // Custom query methods
  async findByEmail(email: string): Promise<UserDTO | null> {
    return await this.findFirst({ where: { email } })
  }

  async findUsersWithPosts(): Promise<UserDTO[]> {
    return await this.findMany({
      include: {
        posts: {
          select: {
            id: true,
            title: true,
            createdAt: true
          }
        }
      }
    })
  }

  async findActiveUsers(): Promise<UserDTO[]> {
    return await this.findMany({
      where: {
        posts: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }]
    })
  }

  // Relationship methods
  posts() {
    return this.hasMany({
      repository: PostRepository,
      entity: () => Post
    })
  }
}
```

## Step 6: Setup Database Connection

Create `src/database.ts`:

```typescript
import { DataSource } from 'typeorm'
import { User } from './entities/User'
import { Post } from './entities/Post'
import { Fluent } from '@goatlab/fluent'

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  entities: [User, Post],
  synchronize: true, // Only for development
  logging: true
})

export async function initializeDatabase() {
  await Fluent.initialize([AppDataSource], [User, Post])
}
```

## Step 7: Create Your First Application

Create `src/app.ts`:

```typescript
import 'reflect-metadata'
import { initializeDatabase, AppDataSource } from './database'
import { UserRepository } from './repositories/UserRepository'

async function main() {
  // Initialize database
  await initializeDatabase()
  
  // Create repository instance
  const userRepo = new UserRepository(AppDataSource)

  // Create a user
  console.log('Creating a new user...')
  const newUser = await userRepo.insert({
    email: 'john@example.com',
    name: 'John Doe',
    age: 30
  })
  console.log('Created user:', newUser)

  // Find the user
  console.log('Finding user by email...')
  const foundUser = await userRepo.findByEmail('john@example.com')
  console.log('Found user:', foundUser)

  // Update the user
  console.log('Updating user...')
  const updatedUser = await userRepo.updateById(newUser.id, {
    name: 'John Smith',
    age: 31
  })
  console.log('Updated user:', updatedUser)

  // Find all users
  console.log('Finding all users...')
  const allUsers = await userRepo.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      age: true
    },
    orderBy: [{ createdAt: 'desc' }]
  })
  console.log('All users:', allUsers)

  // Work with collections
  console.log('Working with collections...')
  const userCollection = await userRepo.collect({
    where: { age: { gte: 25 } }
  })
  
  const adultUsers = userCollection.filter(user => user.age >= 18)
  const userEmails = userCollection.pluck('email')
  
  console.log('Adult users:', adultUsers.toArray())
  console.log('User emails:', userEmails)
}

main().catch(console.error)
```

## Step 8: Run Your Application

Add a script to your `package.json`:

```json
{
  "scripts": {
    "start": "tsx src/app.ts"
  }
}
```

Run your application:

```bash
npm run start
```

## Step 9: Advanced Queries

Try some advanced queries:

```typescript
// Complex where conditions
const users = await userRepo.findMany({
  where: {
    OR: [
      { age: { gte: 25 } },
      { email: { like: '%@company.com' } }
    ],
    AND: [
      { createdAt: { gte: new Date('2024-01-01') } },
      { name: { notIn: ['admin', 'test'] } }
    ]
  },
  select: {
    id: true,
    email: true,
    name: true,
    posts: {
      title: true,
      content: true
    }
  },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})

// Pagination
const paginatedUsers = await userRepo.findMany({
  limit: 10,
  offset: 20,
  orderBy: [{ createdAt: 'desc' }]
})

// Aggregations using collections
const userStats = await userRepo.collect({})
const averageAge = userStats.avg('age')
const maxAge = userStats.max('age')
const totalUsers = userStats.count()
```

## Step 10: Testing

Create a test file `src/tests/UserRepository.test.ts`:

```typescript
import { DataSource } from 'typeorm'
import { UserRepository } from '../repositories/UserRepository'
import { User } from '../entities/User'
import { Post } from '../entities/Post'
import { Fluent } from '@goatlab/fluent'

describe('UserRepository', () => {
  let dataSource: DataSource
  let userRepo: UserRepository

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Post],
      synchronize: true
    })
    
    await Fluent.initialize([dataSource], [User, Post])
    userRepo = new UserRepository(dataSource)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  test('should create and find a user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      age: 25
    }

    const user = await userRepo.insert(userData)
    expect(user).toBeDefined()
    expect(user.email).toBe(userData.email)

    const foundUser = await userRepo.findByEmail(userData.email)
    expect(foundUser).toBeDefined()
    expect(foundUser?.id).toBe(user.id)
  })

  test('should handle type-safe queries', async () => {
    const users = await userRepo.findMany({
      select: {
        id: true,
        email: true,
        name: true
      },
      where: {
        age: { gte: 18 }
      }
    })

    expect(Array.isArray(users)).toBe(true)
    // TypeScript ensures only selected fields are available
    users.forEach(user => {
      expect(user.id).toBeDefined()
      expect(user.email).toBeDefined()
      expect(user.name).toBeDefined()
      // user.age would be a TypeScript error since it's not selected
    })
  })
})
```

## Next Steps

Congratulations! You've successfully created your first Fluent application. Here's what you can explore next:

1. **[Installation Guide](installation.md)** - Complete setup instructions
2. **[Architecture Overview](architecture.md)** - Understand the system design
3. **[Fluent Class Documentation](../core/fluent-class.md)** - Core functionality
4. **[TypeORM Connector Guide](../core/typeorm-connector.md)** - Database integration
5. **[Decorators Reference](../core/decorators.md)** - Entity definition patterns

## Key Takeaways

- **Type Safety**: All queries are fully type-safe with TypeScript
- **Database Agnostic**: Same API works with MySQL, PostgreSQL, MongoDB, SQLite
- **Decorator-based**: Clean entity definitions with decorators
- **Validation**: Automatic input/output validation with Zod
- **Relationships**: Easy handling of complex data relationships
- **Testing**: Comprehensive testing utilities included

Ready to build more complex applications? Check out the complete documentation!
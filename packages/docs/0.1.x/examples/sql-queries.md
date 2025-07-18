# SQL Database Query Examples

This guide provides comprehensive examples of SQL database operations using the TypeORM connector in Goat Fluent.

## Basic CRUD Operations

### Entity Definition

```typescript
// entities/User.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users')
@ObjectType()
export class User {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column({ unique: true })
  @Index()
  @f.Column()
  email: string

  @Column()
  @f.Column()
  firstName: string

  @Column()
  @f.Column()
  lastName: string

  @Column()
  @f.Column()
  age: number

  @Column()
  @f.Column()
  status: 'active' | 'inactive' | 'pending'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' })
  @f.Column()
  updatedAt: Date
}

export const UserInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  age: z.number().min(0).max(150),
  status: z.enum(['active', 'inactive', 'pending']).default('pending')
})

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number(),
  status: z.enum(['active', 'inactive', 'pending']),
  createdAt: z.date(),
  updatedAt: z.date()
})
```

### Repository Setup

```typescript
// repositories/UserRepository.ts
import { TypeOrmConnector } from '@goatlab/fluent'
import { AppDataSource } from '../config/database'
import { User, UserInputSchema, UserOutputSchema } from '../entities/User'

export class UserRepository extends TypeOrmConnector<
  User,
  typeof UserInputSchema._type,
  typeof UserOutputSchema._type
> {
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

## Create Operations

### Insert Single Record

```typescript
const userRepository = new UserRepository()

// Create a new user
const newUser = await userRepository.insert({
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  age: 30,
  status: 'active'
})

console.log('Created user:', newUser)
```

### Insert Multiple Records

```typescript
// Bulk insert users
const usersData = [
  {
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    age: 25,
    status: 'active' as const
  },
  {
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    age: 35,
    status: 'pending' as const
  },
  {
    email: 'charlie@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    age: 28,
    status: 'active' as const
  }
]

const createdUsers = await userRepository.insertMany(usersData)
console.log(`Created ${createdUsers.length} users`)
```

## Read Operations

### Find All Records

```typescript
// Get all users
const allUsers = await userRepository.findMany()
console.log('All users:', allUsers)

// Get all users with specific fields
const userSummaries = await userRepository.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    status: true
  }
})
```

### Find with Filters

```typescript
// Find active users
const activeUsers = await userRepository.findMany({
  where: { status: 'active' }
})

// Find users by age range
const youngUsers = await userRepository.findMany({
  where: {
    age: {
      gte: 18,
      lte: 30
    }
  }
})

// Find users with specific email domain
const gmailUsers = await userRepository.findMany({
  where: {
    email: { contains: '@gmail.com' }
  }
})
```

### Find by ID

```typescript
// Find user by ID
const user = await userRepository.findById('user-uuid-here')
if (user) {
  console.log('Found user:', user)
} else {
  console.log('User not found')
}

// Find user by ID with specific fields
const userProfile = await userRepository.findById('user-uuid-here', {
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true
  }
})
```

### Find First Match

```typescript
// Find first user with specific criteria
const firstActiveUser = await userRepository.findFirst({
  where: { status: 'active' },
  orderBy: { createdAt: 'asc' }
})

// Find first user by email
const userByEmail = await userRepository.findFirst({
  where: { email: 'john.doe@example.com' }
})
```

## Complex Queries

### Logical Operators

```typescript
// AND conditions
const filteredUsers = await userRepository.findMany({
  where: {
    status: 'active',
    age: { gte: 21 },
    email: { contains: '@company.com' }
  }
})

// OR conditions
const usersWithOrCondition = await userRepository.findMany({
  where: {
    OR: [
      { status: 'active' },
      { age: { gte: 65 } }
    ]
  }
})

// Complex nested conditions
const complexQuery = await userRepository.findMany({
  where: {
    AND: [
      {
        OR: [
          { status: 'active' },
          { status: 'pending' }
        ]
      },
      {
        age: { gte: 18 }
      },
      {
        OR: [
          { email: { contains: '@gmail.com' } },
          { email: { contains: '@company.com' } }
        ]
      }
    ]
  }
})
```

### Sorting and Pagination

```typescript
// Sort by single field
const sortedUsers = await userRepository.findMany({
  orderBy: { createdAt: 'desc' }
})

// Sort by multiple fields
const multipleSortUsers = await userRepository.findMany({
  orderBy: [
    { lastName: 'asc' },
    { firstName: 'asc' },
    { createdAt: 'desc' }
  ]
})

// Pagination
const paginatedUsers = await userRepository.findMany({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  limit: 20,
  offset: 0
})

// Get next page
const nextPageUsers = await userRepository.findMany({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  limit: 20,
  offset: 20
})
```

### Date and Time Queries

```typescript
// Users created today
const today = new Date()
today.setHours(0, 0, 0, 0)
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)

const usersCreatedToday = await userRepository.findMany({
  where: {
    createdAt: {
      gte: today,
      lt: tomorrow
    }
  }
})

// Users created in the last 7 days
const lastWeek = new Date()
lastWeek.setDate(lastWeek.getDate() - 7)

const recentUsers = await userRepository.findMany({
  where: {
    createdAt: { gte: lastWeek }
  },
  orderBy: { createdAt: 'desc' }
})

// Users created in a specific month
const usersInJanuary = await userRepository.findMany({
  where: {
    createdAt: {
      gte: new Date('2023-01-01'),
      lt: new Date('2023-02-01')
    }
  }
})
```

## Update Operations

### Update Single Record

```typescript
// Update user by ID
const updatedUser = await userRepository.updateById('user-uuid-here', {
  firstName: 'John Updated',
  lastName: 'Doe Updated',
  status: 'active'
})

console.log('Updated user:', updatedUser)
```

### Update Multiple Records

```typescript
// Update all pending users to active
const updatedUsers = await userRepository.updateMany(
  { where: { status: 'pending' } },
  { status: 'active' }
)

console.log(`Updated ${updatedUsers.length} users`)

// Update users by age range
const updatedOlderUsers = await userRepository.updateMany(
  { 
    where: { 
      age: { gte: 65 },
      status: 'active'
    } 
  },
  { status: 'inactive' }
)
```

## Delete Operations

### Delete Single Record

```typescript
// Delete user by ID
const deletedUser = await userRepository.deleteById('user-uuid-here')
console.log('Deleted user:', deletedUser)
```

### Delete Multiple Records

```typescript
// Delete inactive users
const deletedUsers = await userRepository.deleteMany({
  where: { status: 'inactive' }
})

console.log(`Deleted ${deletedUsers.length} users`)

// Delete users created before a specific date
const cutoffDate = new Date('2022-01-01')
const deletedOldUsers = await userRepository.deleteMany({
  where: {
    createdAt: { lt: cutoffDate },
    status: 'inactive'
  }
})
```

## Advanced SQL Queries

### Raw SQL Queries

```typescript
// Execute raw SQL query
const rawResults = await userRepository.query(`
  SELECT 
    status,
    COUNT(*) as count,
    AVG(age) as average_age
  FROM users 
  WHERE created_at >= ?
  GROUP BY status
  ORDER BY count DESC
`, [new Date('2023-01-01')])

console.log('Status statistics:', rawResults)
```

### Aggregation Queries

```typescript
// Count records
const totalUsers = await userRepository.count()
const activeUsers = await userRepository.count({
  where: { status: 'active' }
})

console.log(`Total users: ${totalUsers}, Active users: ${activeUsers}`)

// Group by status
const statusCounts = await userRepository.query(`
  SELECT status, COUNT(*) as count
  FROM users
  GROUP BY status
`)

// Age statistics
const ageStats = await userRepository.query(`
  SELECT 
    MIN(age) as min_age,
    MAX(age) as max_age,
    AVG(age) as avg_age,
    COUNT(*) as total_users
  FROM users
  WHERE status = 'active'
`)
```

## Relationships and Joins

### One-to-Many Relationship

```typescript
// Post entity
@Entity('posts')
@ObjectType()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  @Column()
  @f.Column()
  title: string

  @Column('text')
  @f.Column()
  content: string

  @Column()
  @f.Column()
  authorId: string

  @ManyToOne(() => User, user => user.posts)
  @JoinColumn({ name: 'authorId' })
  author: User

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @f.Column()
  createdAt: Date
}

// Update User entity to include posts
@OneToMany(() => Post, post => post.author)
@f.Column()
posts: Post[]
```

### Query with Relations

```typescript
// Find users with their posts
const usersWithPosts = await userRepository.findMany({
  include: {
    posts: true
  }
})

// Find users with filtered posts
const usersWithRecentPosts = await userRepository.findMany({
  include: {
    posts: {
      where: {
        createdAt: { gte: new Date('2023-01-01') }
      },
      orderBy: { createdAt: 'desc' }
    }
  },
  where: { status: 'active' }
})
```

## Transaction Examples

### Simple Transaction

```typescript
// Execute operations in transaction
const result = await userRepository.transaction(async (manager) => {
  // Create user
  const user = await manager.save(User, {
    email: 'transaction@example.com',
    firstName: 'Transaction',
    lastName: 'User',
    age: 25,
    status: 'active'
  })

  // Create related post
  const post = await manager.save(Post, {
    title: 'First Post',
    content: 'This is my first post',
    authorId: user.id
  })

  return { user, post }
})

console.log('Transaction completed:', result)
```

### Complex Transaction

```typescript
// Transfer operation with transaction
const transferUsers = async (fromUserId: string, toUserId: string, amount: number) => {
  return await userRepository.transaction(async (manager) => {
    // Get both users
    const fromUser = await manager.findOne(User, { where: { id: fromUserId } })
    const toUser = await manager.findOne(User, { where: { id: toUserId } })

    if (!fromUser || !toUser) {
      throw new Error('Users not found')
    }

    // Update balances (assuming balance field exists)
    fromUser.balance -= amount
    toUser.balance += amount

    // Save both users
    await manager.save(fromUser)
    await manager.save(toUser)

    // Log transaction
    await manager.save(TransactionLog, {
      fromUserId,
      toUserId,
      amount,
      type: 'transfer',
      timestamp: new Date()
    })

    return { fromUser, toUser }
  })
}
```

## Performance Optimization Examples

### Batch Operations

```typescript
// Efficient batch updates
const batchUpdateUsers = async (userIds: string[], updateData: Partial<User>) => {
  const batchSize = 100
  const results = []

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    
    const batchResults = await userRepository.updateMany(
      { where: { id: { in: batch } } },
      updateData
    )
    
    results.push(...batchResults)
  }

  return results
}
```

### Optimized Queries

```typescript
// Use indexes effectively
const findUsersByEmailDomain = async (domain: string) => {
  return await userRepository.findMany({
    where: {
      email: { contains: `@${domain}` }
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    },
    orderBy: { email: 'asc' }
  })
}

// Pagination with cursor
const paginateUsers = async (cursor?: string, limit: number = 20) => {
  const where = cursor ? { id: { gt: cursor } } : {}
  
  return await userRepository.findMany({
    where,
    orderBy: { id: 'asc' },
    limit
  })
}
```

This comprehensive guide covers all the essential SQL database operations you can perform with the TypeORM connector in Goat Fluent.
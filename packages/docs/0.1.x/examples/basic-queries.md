# Basic Query Patterns

This guide covers fundamental query patterns in the Fluent ecosystem with practical examples.

## Setup

Before diving into queries, let's set up a basic repository:

```typescript
import { TypeOrmConnector, f } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// Define entity
@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  email: string

  @f.property()
  age: number

  @f.property()
  active: boolean

  @f.property()
  createdAt: Date

  @f.property()
  updatedAt: Date
}

// Define schemas
const UserInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0),
  active: z.boolean().default(true)
})

const UserOutputSchema = UserInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})

// Create repository
class UserRepository extends TypeOrmConnector<
  User,
  z.infer<typeof UserInputSchema>,
  z.infer<typeof UserOutputSchema>
> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

## Basic CRUD Operations

### Creating Records

#### Single Insert

```typescript
const userRepo = new UserRepository(dataSource)

// Create a single user
const user = await userRepo.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  active: true
})

console.log(user)
// Output: { id: 'uuid', name: 'John Doe', email: 'john@example.com', ... }
```

#### Multiple Inserts

```typescript
// Create multiple users at once
const users = await userRepo.insertMany([
  { name: 'John Doe', email: 'john@example.com', age: 30 },
  { name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  { name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
])

console.log(`Created ${users.length} users`)
```

#### Insert with Custom ID

```typescript
// Insert with a specific ID
const user = await userRepo.insert({
  id: '12345',
  name: 'Admin User',
  email: 'admin@example.com',
  age: 40
})
```

### Reading Records

#### Find by ID

```typescript
// Find user by ID
const user = await userRepo.findById('user-123')

if (user) {
  console.log(`Found user: ${user.name}`)
} else {
  console.log('User not found')
}
```

#### Find Multiple by IDs

```typescript
// Find multiple users by IDs
const users = await userRepo.findByIds(['user-1', 'user-2', 'user-3'])

console.log(`Found ${users.length} users`)
```

#### Find Many with Basic Filters

```typescript
// Find all active users
const activeUsers = await userRepo.findMany({
  where: { active: true }
})

// Find users by age
const adults = await userRepo.findMany({
  where: { age: { gte: 18 } }
})

// Find users by name pattern
const johnsUsers = await userRepo.findMany({
  where: { name: { contains: 'John' } }
})
```

#### Find First

```typescript
// Find first user matching criteria
const firstAdult = await userRepo.findFirst({
  where: { age: { gte: 18 } },
  orderBy: [{ age: 'asc' }]
})

if (firstAdult) {
  console.log(`Youngest adult: ${firstAdult.name}, age ${firstAdult.age}`)
}
```

#### Require Methods (Throw if Not Found)

```typescript
// Require user by ID (throws error if not found)
try {
  const user = await userRepo.requireById('user-123')
  console.log(`User found: ${user.name}`)
} catch (error) {
  console.error('User not found:', error.message)
}

// Require first matching user
try {
  const admin = await userRepo.requireFirst({
    where: { email: { endsWith: '@admin.com' } }
  })
  console.log(`Admin found: ${admin.name}`)
} catch (error) {
  console.error('No admin found')
}
```

### Updating Records

#### Update by ID

```typescript
// Update user by ID
const updatedUser = await userRepo.updateById('user-123', {
  name: 'John Updated',
  age: 31
})

console.log(`Updated user: ${updatedUser.name}`)
```

#### Replace by ID

```typescript
// Replace entire user record
const replacedUser = await userRepo.replaceById('user-123', {
  name: 'John Replaced',
  email: 'john.new@example.com',
  age: 32,
  active: false
})
```

### Deleting Records

#### Delete by ID

```typescript
// Delete user by ID
const deletedId = await userRepo.deleteById('user-123')
console.log(`Deleted user with ID: ${deletedId}`)
```

## Field Selection

### Select Specific Fields

```typescript
// Select only name and email
const users = await userRepo.findMany({
  select: {
    name: true,
    email: true
  }
})

// Result: Array<{ name: string; email: string }>
```

### Select with Conditions

```typescript
// Select specific fields with filtering
const activeUserEmails = await userRepo.findMany({
  select: {
    email: true,
    name: true
  },
  where: { active: true }
})
```

### Nested Field Selection

```typescript
// For nested objects (if User had a profile)
const users = await userRepo.findMany({
  select: {
    name: true,
    profile: {
      avatar: true,
      bio: true
    }
  }
})
```

## Filtering and Conditions

### Basic Equality

```typescript
// Exact match
const user = await userRepo.findFirst({
  where: { email: 'john@example.com' }
})

// Boolean values
const activeUsers = await userRepo.findMany({
  where: { active: true }
})
```

### Comparison Operators

```typescript
// Greater than
const adults = await userRepo.findMany({
  where: { age: { gt: 18 } }
})

// Greater than or equal
const adults = await userRepo.findMany({
  where: { age: { gte: 18 } }
})

// Less than
const youngUsers = await userRepo.findMany({
  where: { age: { lt: 25 } }
})

// Less than or equal
const youngUsers = await userRepo.findMany({
  where: { age: { lte: 25 } }
})

// Range queries
const middleAged = await userRepo.findMany({
  where: { 
    age: { 
      gte: 25, 
      lte: 65 
    } 
  }
})
```

### String Operations

```typescript
// Contains
const johnsUsers = await userRepo.findMany({
  where: { name: { contains: 'John' } }
})

// Starts with
const jUsers = await userRepo.findMany({
  where: { name: { startsWith: 'J' } }
})

// Ends with
const gmailUsers = await userRepo.findMany({
  where: { email: { endsWith: '@gmail.com' } }
})
```

### Array Operations

```typescript
// In array
const specificUsers = await userRepo.findMany({
  where: { 
    id: { 
      in: ['user-1', 'user-2', 'user-3'] 
    } 
  }
})

// Not in array
const excludedUsers = await userRepo.findMany({
  where: { 
    id: { 
      notIn: ['user-1', 'user-2'] 
    } 
  }
})
```

### Null Checks

```typescript
// Is null
const usersWithoutEmail = await userRepo.findMany({
  where: { email: { isNull: true } }
})

// Is not null
const usersWithEmail = await userRepo.findMany({
  where: { email: { isNotNull: true } }
})
```

## Logical Operators

### OR Conditions

```typescript
// Users who are either admins or over 65
const privilegedUsers = await userRepo.findMany({
  where: {
    OR: [
      { email: { endsWith: '@admin.com' } },
      { age: { gt: 65 } }
    ]
  }
})
```

### AND Conditions

```typescript
// Active users between 18 and 65
const workingAgeUsers = await userRepo.findMany({
  where: {
    AND: [
      { active: true },
      { age: { gte: 18 } },
      { age: { lte: 65 } }
    ]
  }
})
```

### NOT Conditions

```typescript
// Users who are not from Gmail
const nonGmailUsers = await userRepo.findMany({
  where: {
    NOT: {
      email: { endsWith: '@gmail.com' }
    }
  }
})
```

### Complex Logical Combinations

```typescript
// Complex query: Active users who are either young or admins
const users = await userRepo.findMany({
  where: {
    AND: [
      { active: true },
      {
        OR: [
          { age: { lt: 25 } },
          { email: { endsWith: '@admin.com' } }
        ]
      }
    ]
  }
})
```

## Sorting and Ordering

### Single Field Sorting

```typescript
// Sort by name ascending
const users = await userRepo.findMany({
  orderBy: [{ name: 'asc' }]
})

// Sort by age descending
const users = await userRepo.findMany({
  orderBy: [{ age: 'desc' }]
})
```

### Multiple Field Sorting

```typescript
// Sort by age desc, then by name asc
const users = await userRepo.findMany({
  orderBy: [
    { age: 'desc' },
    { name: 'asc' }
  ]
})
```

### Sorting with Conditions

```typescript
// Get active users sorted by creation date
const recentActiveUsers = await userRepo.findMany({
  where: { active: true },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})
```

## Pagination

### Limit and Offset

```typescript
// Get first 10 users
const firstPage = await userRepo.findMany({
  limit: 10,
  offset: 0
})

// Get next 10 users
const secondPage = await userRepo.findMany({
  limit: 10,
  offset: 10
})
```

### Paginated Results

```typescript
// Get paginated results with metadata
const paginatedUsers = await userRepo.findMany({
  limit: 10,
  offset: 0,
  paginated: { page: 1, perPage: 10 }
})

// Result includes data and pagination metadata
console.log(paginatedUsers.data) // Array of users
console.log(paginatedUsers.meta) // { page: 1, perPage: 10, total: 100, ... }
```

## Utility Methods

### Pluck Values

```typescript
// Get all user names
const names = await userRepo.pluck('name')
// Result: ['John Doe', 'Jane Smith', 'Bob Johnson']

// Get names of active users only
const activeNames = await userRepo.pluck('name', {
  where: { active: true }
})
```

### Collection Methods

```typescript
// Get results as a Collection for advanced manipulation
const users = await userRepo.collect({
  where: { active: true }
})

// Use collection methods
const names = users.pluck('name')
const grouped = users.groupBy('age')
const sorted = users.sortBy('name')
```

## Common Patterns

### Search Pattern

```typescript
// Search users by name or email
const searchUsers = async (searchTerm: string) => {
  return await userRepo.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm } },
        { email: { contains: searchTerm } }
      ]
    },
    orderBy: [{ name: 'asc' }]
  })
}

const results = await searchUsers('john')
```

### Recent Items Pattern

```typescript
// Get recent users
const getRecentUsers = async (limit = 10) => {
  return await userRepo.findMany({
    orderBy: [{ createdAt: 'desc' }],
    limit
  })
}
```

### Active Items Pattern

```typescript
// Get active users with pagination
const getActiveUsers = async (page = 1, perPage = 20) => {
  return await userRepo.findMany({
    where: { active: true },
    orderBy: [{ createdAt: 'desc' }],
    limit: perPage,
    offset: (page - 1) * perPage
  })
}
```

### Count Pattern

```typescript
// Count active users
const countActiveUsers = async () => {
  const users = await userRepo.findMany({
    where: { active: true },
    select: { id: true }
  })
  return users.length
}
```

## Error Handling

### Try-Catch Pattern

```typescript
import { Promises } from '@goatlab/js-utils'

// Using try-catch utility
const [error, user] = await Promises.try(
  userRepo.requireById('user-123')
)

if (error) {
  console.error('User not found:', error.message)
} else {
  console.log('User found:', user.name)
}
```

### Validation Errors

```typescript
try {
  await userRepo.insert({
    name: 'John',
    email: 'invalid-email', // This will fail validation
    age: -5 // This will fail validation
  })
} catch (error) {
  if (error.name === 'ZodError') {
    console.error('Validation errors:', error.errors)
  }
}
```

## Performance Tips

1. **Use select** to only fetch needed fields
2. **Use indexes** on frequently queried fields
3. **Use pagination** for large datasets
4. **Use pluck** for simple value extraction
5. **Use batch operations** for multiple inserts

## Next Steps

- [Complex Queries](./complex-queries.md) - Advanced query patterns
- [CRUD Operations](./crud-operations.md) - Complete CRUD examples
- [Relationships](./relations.md) - Working with relationships
- [Aggregations](./aggregations.md) - Aggregation and grouping queries
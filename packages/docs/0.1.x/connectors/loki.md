# LokiJS Connector

The LokiJS connector provides integration with LokiJS, a fast, in-memory JavaScript database designed for high-performance applications, prototyping, and testing.

## Overview

The `LokiConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a unified API for LokiJS operations while maintaining full compatibility with the Fluent query interface.

### Features

- **In-Memory Performance** - Lightning-fast operations
- **Persistence Options** - Save data to file system or localStorage
- **No External Dependencies** - Pure JavaScript implementation
- **Full-Text Search** - Built-in search capabilities
- **Change Tracking** - Track document changes
- **Lightweight** - Small footprint, perfect for development and testing

## Installation

```bash
npm install @goatlab/fluent-loki lokijs
```

## Setup

### 1. Initialize LokiJS Database

```typescript
import LokiJS from 'lokijs'
import { LokiConnector } from '@goatlab/fluent-loki'

// In-memory database
const db = new LokiJS('myapp.db')

// Persistent database (Node.js)
const db = new LokiJS('myapp.db', {
  persistenceMethod: 'fs',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000
})

// Persistent database (Browser)
const db = new LokiJS('myapp.db', {
  persistenceMethod: 'localStorage',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000
})
```

### 2. Define Your Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users') // Collection name in LokiJS
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

  @Column()
  @f.Column()
  age?: number

  @Column()
  @f.Column()
  tags: string[]

  @Column({ type: 'timestamp' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp' })
  @f.Column()
  updatedAt: Date
}

// Define your schemas
export const UserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().min(0).max(150).optional(),
  tags: z.array(z.string()).default([])
})

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
})
```

### 3. Create Repository

```typescript
import { LokiConnector } from '@goatlab/fluent-loki'
import { User, UserInputSchema, UserOutputSchema } from './entities/User'

export class UserRepository extends LokiConnector<User, typeof UserInputSchema._type, typeof UserOutputSchema._type> {
  constructor(db: LokiJS) {
    super({
      entity: User,
      dataSource: db,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### 4. Initialize and Use

```typescript
import { Fluent } from '@goatlab/fluent'
import { modelGeneratorDataSource } from '@goatlab/fluent'
import { User } from './entities/User'
import LokiJS from 'lokijs'

// Initialize LokiJS
const db = new LokiJS('myapp.db')

// Initialize Fluent
await Fluent.initialize([modelGeneratorDataSource], [User])

// Create repository instance
const userRepository = new UserRepository(db)

// Use the repository
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30,
  tags: ['developer', 'nodejs']
})
```

## CRUD Operations

### Create

```typescript
// Insert single document
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30,
  tags: ['developer', 'nodejs']
})

// Insert multiple documents
const users = await userRepository.insertMany([
  { email: 'john@example.com', name: 'John Doe', age: 30, tags: ['developer'] },
  { email: 'jane@example.com', name: 'Jane Smith', age: 25, tags: ['designer'] }
])
```

### Read

```typescript
// Find all users
const users = await userRepository.findMany()

// Find with filters
const users = await userRepository.findMany({
  where: { 
    age: { gte: 18 },
    tags: { contains: 'developer' }
  },
  orderBy: { createdAt: 'desc' },
  limit: 10
})

// Find by ID
const user = await userRepository.findById('user-id')

// Find first matching document
const user = await userRepository.findFirst({
  where: { email: 'john@example.com' }
})
```

### Update

```typescript
// Update by ID
const updatedUser = await userRepository.updateById('user-id', {
  name: 'John Updated',
  age: 31
})

// Update many with conditions
const updatedUsers = await userRepository.updateMany(
  { where: { age: { lt: 18 } } },
  { tags: ['minor'] }
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

## LokiJS-Specific Features

### Collections and Indexes

```typescript
// Access the underlying LokiJS collection
const collection = userRepository.getCollection()

// Create indexes for better performance
collection.ensureIndex('email')
collection.ensureIndex('age')
collection.ensureIndex('tags')

// Composite indexes
collection.ensureIndex(['age', 'tags'])
```

### Views

```typescript
// Create a view for active users
const activeUsersView = collection.addDynamicView('activeUsers')
activeUsersView.applyFind({ status: 'active' })
activeUsersView.applySimpleSort('createdAt', true)

// Get view data
const activeUsers = activeUsersView.data()

// Update view criteria
activeUsersView.applyFind({ status: 'active', age: { '$gte': 18 } })
```

### Full-Text Search

```typescript
// Enable full-text search
collection.ensureIndex('name')
collection.ensureIndex('email')

// Search across multiple fields
const users = await userRepository.findMany({
  where: {
    OR: [
      { name: { contains: 'John' } },
      { email: { contains: 'john' } }
    ]
  }
})
```

### Change Tracking

```typescript
// Enable change tracking
const collection = userRepository.getCollection()

// Listen to changes
collection.on('insert', (obj) => {
  console.log('Document inserted:', obj)
})

collection.on('update', (obj) => {
  console.log('Document updated:', obj)
})

collection.on('delete', (obj) => {
  console.log('Document deleted:', obj)
})
```

## Query Operators

### Comparison Operators

```typescript
// Equal
const users = await userRepository.findMany({
  where: { age: 30 }
})

// Greater than
const users = await userRepository.findMany({
  where: { age: { gt: 18 } }
})

// Greater than or equal
const users = await userRepository.findMany({
  where: { age: { gte: 18 } }
})

// Less than
const users = await userRepository.findMany({
  where: { age: { lt: 65 } }
})

// Less than or equal
const users = await userRepository.findMany({
  where: { age: { lte: 65 } }
})

// Not equal
const users = await userRepository.findMany({
  where: { status: { ne: 'deleted' } }
})
```

### Array Operations

```typescript
// Contains value in array
const users = await userRepository.findMany({
  where: { tags: { contains: 'developer' } }
})

// Contains any of these values
const users = await userRepository.findMany({
  where: { tags: { containsAny: ['developer', 'designer'] } }
})

// Size of array
const users = await userRepository.findMany({
  where: { tags: { size: 2 } }
})
```

### String Operations

```typescript
// Contains substring
const users = await userRepository.findMany({
  where: { name: { contains: 'John' } }
})

// Starts with
const users = await userRepository.findMany({
  where: { email: { startsWith: 'john' } }
})

// Ends with
const users = await userRepository.findMany({
  where: { email: { endsWith: '@gmail.com' } }
})

// Regular expression
const users = await userRepository.findMany({
  where: { email: { regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ } }
})
```

### Complex Queries

```typescript
// Multiple conditions (AND)
const users = await userRepository.findMany({
  where: {
    age: { gte: 18, lte: 65 },
    tags: { contains: 'developer' },
    status: 'active'
  }
})

// OR conditions
const users = await userRepository.findMany({
  where: {
    OR: [
      { age: { lt: 18 } },
      { age: { gt: 65 } }
    ]
  }
})

// Nested conditions
const users = await userRepository.findMany({
  where: {
    AND: [
      {
        OR: [
          { tags: { contains: 'developer' } },
          { tags: { contains: 'designer' } }
        ]
      },
      { age: { gte: 18 } }
    ]
  }
})
```

## Persistence Options

### File System Persistence (Node.js)

```typescript
import LokiJS from 'lokijs'

const db = new LokiJS('myapp.db', {
  persistenceMethod: 'fs',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000, // Save every 4 seconds
  serializationMethod: 'normal', // 'normal', 'pretty', 'destructured'
  destructureDelimiter: '$<>'
})

function databaseInitialize() {
  // Database loaded from file
  console.log('Database loaded')
}
```

### localStorage Persistence (Browser)

```typescript
import LokiJS from 'lokijs'

const db = new LokiJS('myapp.db', {
  persistenceMethod: 'localStorage',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000
})
```

### IndexedDB Persistence (Browser)

```typescript
import LokiJS from 'lokijs'

const db = new LokiJS('myapp.db', {
  persistenceMethod: 'indexeddb',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000
})
```

### Manual Persistence

```typescript
// Save manually
await db.saveDatabase()

// Load manually
await db.loadDatabase()

// Export database
const serialized = db.serialize()

// Import database
db.loadJSON(serialized)
```

## Performance Optimization

### Indexing Strategy

```typescript
// Create indexes for frequently queried fields
const collection = userRepository.getCollection()

// Single field indexes
collection.ensureIndex('email')
collection.ensureIndex('age')
collection.ensureIndex('status')

// Composite indexes for complex queries
collection.ensureIndex(['status', 'age'])
collection.ensureIndex(['tags', 'createdAt'])
```

### Memory Management

```typescript
// Configure memory limits
const db = new LokiJS('myapp.db', {
  persistenceMethod: 'fs',
  autoload: true,
  autoloadCallback: databaseInitialize,
  autosave: true,
  autosaveInterval: 4000,
  
  // Memory management options
  throttledSaves: true, // Throttle saves to reduce I/O
  serializationMethod: 'destructured' // More memory efficient
})
```

### Batch Operations

```typescript
// Insert many documents at once
const users = await userRepository.insertMany(largeUserArray)

// Update many documents
await userRepository.updateMany(
  { where: { status: 'inactive' } },
  { status: 'active' }
)

// Delete many documents
await userRepository.deleteMany({
  where: { createdAt: { lt: new Date('2023-01-01') } }
})
```

## Advanced Features

### Transforms

```typescript
// Create a transform for data manipulation
const collection = userRepository.getCollection()

const transform = collection.addTransform('activeUsers', [
  {
    type: 'find',
    value: { status: 'active' }
  },
  {
    type: 'simplesort',
    property: 'createdAt',
    desc: true
  },
  {
    type: 'limit',
    value: 10
  }
])

// Use transform
const activeUsers = transform.data()
```

### Change Events

```typescript
// Listen to database events
db.on('close', () => {
  console.log('Database closed')
})

db.on('changes', (changes) => {
  console.log('Database changes:', changes)
})

db.on('flushChanges', () => {
  console.log('Changes flushed')
})
```

### Cloning and Snapshots

```typescript
// Clone a document
const user = await userRepository.findById('user-id')
const clonedUser = collection.clone(user)

// Create a snapshot
const snapshot = collection.chain().data({ removeMeta: true })
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
    // Handle LokiJS errors
    console.log('LokiJS error:', error.message)
  }
}
```

## Testing with LokiJS

### In-Memory Testing

```typescript
// test/userRepository.test.ts
import LokiJS from 'lokijs'
import { UserRepository } from '../src/repositories/UserRepository'

describe('UserRepository', () => {
  let db: LokiJS
  let userRepository: UserRepository

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new LokiJS('test.db')
    userRepository = new UserRepository(db)
  })

  afterEach(() => {
    // Clean up
    db.close()
  })

  it('should insert a user', async () => {
    const user = await userRepository.insert({
      email: 'john@example.com',
      name: 'John Doe',
      age: 30,
      tags: ['developer']
    })

    expect(user.id).toBeDefined()
    expect(user.email).toBe('john@example.com')
  })

  it('should find users by tag', async () => {
    await userRepository.insertMany([
      { email: 'john@example.com', name: 'John Doe', tags: ['developer'] },
      { email: 'jane@example.com', name: 'Jane Smith', tags: ['designer'] }
    ])

    const developers = await userRepository.findMany({
      where: { tags: { contains: 'developer' } }
    })

    expect(developers).toHaveLength(1)
    expect(developers[0].name).toBe('John Doe')
  })
})
```

## Best Practices

1. **Use indexes** for frequently queried fields
2. **Enable persistence** for data that needs to survive restarts
3. **Use views** for complex, reusable queries
4. **Implement change tracking** for audit trails
5. **Use batch operations** for multiple operations
6. **Configure autosave** to prevent data loss
7. **Use transforms** for data aggregation
8. **Implement proper error handling** with try-catch blocks
9. **Use in-memory databases** for testing
10. **Monitor memory usage** for large datasets

## Troubleshooting

### Common Issues

1. **Memory Usage**: Monitor memory consumption with large datasets
2. **Persistence Issues**: Check file permissions and disk space
3. **Performance**: Add indexes for slow queries
4. **Data Loss**: Enable autosave and handle errors properly
5. **Browser Limits**: Be aware of localStorage size limits

### Debug Mode

```typescript
// Enable debug logging
const db = new LokiJS('myapp.db', {
  verbose: true, // Enable verbose logging
  persistenceMethod: 'fs',
  autoload: true,
  autoloadCallback: databaseInitialize
})

// Monitor collection statistics
const collection = userRepository.getCollection()
console.log('Collection stats:', collection.stats())
```

## Migration from Other Databases

### From MongoDB

```typescript
// MongoDB-style queries work with minor modifications
const users = await userRepository.findMany({
  where: {
    age: { gte: 18 }, // MongoDB: { age: { $gte: 18 } }
    tags: { contains: 'developer' } // MongoDB: { tags: { $in: ['developer'] } }
  }
})
```

### From SQL

```typescript
// SQL-style queries
const users = await userRepository.findMany({
  where: {
    age: { gte: 18, lte: 65 }, // SQL: age >= 18 AND age <= 65
    name: { contains: 'John' } // SQL: name LIKE '%John%'
  },
  orderBy: { createdAt: 'desc' }, // SQL: ORDER BY createdAt DESC
  limit: 10 // SQL: LIMIT 10
})
```

LokiJS provides an excellent lightweight alternative for development, testing, and applications that need fast in-memory operations with optional persistence.
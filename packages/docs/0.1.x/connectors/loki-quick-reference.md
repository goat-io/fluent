# LokiJS Quick Reference

Essential patterns and examples for the LokiJS connector.

## Setup

```typescript
import { Loki, LokiConnector, LokiStorageType } from '@goatlab/fluent-loki'
import { z } from 'zod'

// Schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  tags: z.array(z.string()).default([])
})

// Database
const db = Loki.createDb({
  dbName: 'myapp',
  storage: LokiStorageType.memory // indexedDB, file, fsStructured, cryptedFile, json
})

// Connector
const users = new LokiConnector({
  entity: { name: 'users' },
  dataSource: db,
  inputSchema: UserSchema,
  outputSchema: UserSchema
})
```

## Storage Options

```typescript
// Memory (testing)
LokiStorageType.memory

// Browser persistence
LokiStorageType.indexedDB

// Node.js file
LokiStorageType.file

// Structured file
LokiStorageType.fsStructured

// Encrypted file (requires secret)
Loki.createDb({
  dbName: 'secure',
  storage: LokiStorageType.cryptedFile,
  secret: 'your-secret'
})

// Mobile (NativeScript)
LokiStorageType.json
```

## CRUD Operations

```typescript
// Create
const user = await users.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  tags: ['developer']
})

// Read all
const allUsers = await users.findMany()

// Read with conditions
const adults = await users.findMany({
  where: { age: { gte: 18 } },
  orderBy: [{ name: 'asc' }],
  limit: 10
})

// Read by ID
const user = await users.findById('user-id')

// Update (partial)
const updated = await users.updateById('user-id', {
  name: 'Jane Doe'
})

// Replace (full)
const replaced = await users.replaceById('user-id', {
  name: 'John Smith',
  email: 'john.smith@example.com',
  age: 31,
  tags: ['manager']
})

// Delete
await users.deleteById('user-id')

// Clear all
await users.clear()
```

## Query Operators

```typescript
// Comparison
{ age: 25 }                    // equals
{ age: { gt: 25 } }            // greater than
{ age: { gte: 25 } }           // greater than or equal
{ age: { lt: 65 } }            // less than
{ age: { lte: 65 } }           // less than or equal
{ status: { isNot: 'deleted' } } // not equal

// Arrays
{ status: { in: ['active', 'pending'] } }      // in array
{ status: { notIn: ['deleted', 'banned'] } }   // not in array
{ tags: { in: ['developer'] } }                // array contains

// Existence
{ phoneNumber: { exists: true } }     // field exists
{ deletedAt: { notExists: true } }    // field doesn't exist

// Regex
{ email: { regexp: '^john.*@gmail\\.com$' } }

// Nested properties
{ 'address.city': 'New York' }
{ address: { city: 'New York', country: 'USA' } } // auto-converted to dot notation
```

## Complex Queries

```typescript
// AND conditions (default)
const users = await users.findMany({
  where: {
    status: 'active',
    age: { gte: 18 },
    tags: { in: ['developer'] }
  }
})

// OR conditions
const users = await users.findMany({
  where: {
    OR: [
      { age: { lt: 18 } },
      { age: { gt: 65 } }
    ]
  }
})

// Mixed AND/OR
const users = await users.findMany({
  where: {
    status: 'active', // AND with below
    AND: [
      { age: { gte: 18 } }
    ],
    OR: [
      { role: 'admin' },
      { permissions: { in: ['super'] } }
    ]
  }
})
```

## Sorting and Pagination

```typescript
// Single sort
{ orderBy: [{ name: 'asc' }] }
{ orderBy: [{ createdAt: 'desc' }] }

// Multiple sorts
{ orderBy: [{ status: 'asc' }, { name: 'asc' }] }

// Nested property sort
{ orderBy: [{ 'profile.score': 'desc' }] }

// Pagination
{
  paginated: {
    page: 1,
    perPage: 20
  }
}

// Offset/Limit
{
  offset: 10,
  limit: 20
}

// Select fields
{
  select: ['id', 'name', 'email']
}
```

## Bulk Operations

```typescript
// Insert many
const users = await users.insertMany([
  { name: 'John', email: 'john@example.com' },
  { name: 'Jane', email: 'jane@example.com' }
])

// Update many (not built-in, use raw collection)
const collection = users.raw()
const docs = collection.find({ status: 'pending' })
docs.forEach(doc => {
  doc.status = 'active'
  doc.updatedAt = new Date()
  collection.update(doc)
})

// Delete many (not built-in, use raw collection)
collection.findAndRemove({ status: 'inactive' })
```

## Utility Operations

```typescript
// Pluck single field
const emails = await users.pluck('email', {
  where: { status: 'active' }
})
// Returns: ['john@example.com', 'jane@example.com']

// Pluck nested field
const cities = await users.pluck('address.city')

// Count (via findMany)
const activeCount = (await users.findMany({
  where: { status: 'active' }
})).length

// Exists check
const hasAdmins = (await users.findMany({
  where: { role: 'admin' },
  limit: 1
})).length > 0
```

## Direct LokiJS Access

```typescript
// Get raw collection
const collection = users.raw()

// Direct LokiJS operations
collection.ensureIndex('email')
collection.ensureIndex(['status', 'age'])

// Create view
const activeView = collection.addDynamicView('active')
activeView.applyFind({ status: 'active' })
const activeUsers = activeView.data()

// Collection stats
const stats = collection.stats()

// Export/Import
const data = collection.chain().data({ removeMeta: true })
collection.insert(importedData)
```

## Common Patterns

### Repository Pattern

```typescript
export class UserRepository extends LokiConnector<User, UserInput, UserOutput> {
  constructor(db: LokiJS) {
    super({
      entity: { name: 'users' },
      dataSource: db,
      inputSchema: UserSchema,
      outputSchema: UserSchema
    })
  }
  
  async findByEmail(email: string) {
    const users = await this.findMany({
      where: { email },
      limit: 1
    })
    return users[0] || null
  }
  
  async findActive() {
    return this.findMany({
      where: { status: 'active' },
      orderBy: [{ createdAt: 'desc' }]
    })
  }
}
```

### Factory Pattern

```typescript
export class DatabaseFactory {
  static createUserRepository(storageType: LokiStorageType = LokiStorageType.memory) {
    const db = Loki.createDb({
      dbName: 'users',
      storage: storageType
    })
    
    return new LokiConnector({
      entity: { name: 'users' },
      dataSource: db,
      inputSchema: UserSchema,
      outputSchema: UserSchema
    })
  }
}
```

### Testing Setup

```typescript
describe('User operations', () => {
  let users: LokiConnector<User, UserInput, UserOutput>
  
  beforeEach(() => {
    const db = Loki.createDb({
      dbName: 'test',
      storage: LokiStorageType.memory
    })
    
    users = new LokiConnector({
      entity: { name: 'users' },
      dataSource: db,
      inputSchema: UserSchema,
      outputSchema: UserSchema
    })
  })
  
  it('should create user', async () => {
    const user = await users.insert({
      name: 'John',
      email: 'john@example.com'
    })
    
    expect(user.id).toBeDefined()
    expect(user.name).toBe('John')
  })
})
```

## Error Handling

```typescript
try {
  const user = await users.insert({
    name: '',
    email: 'invalid-email'
  })
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log('Validation errors:', error.errors)
  } else {
    console.log('Database error:', error.message)
  }
}
```

## Performance Tips

1. **Use indexes** for frequently queried fields
2. **Limit results** to avoid loading large datasets
3. **Use select** to only fetch needed fields
4. **Enable persistence** for data durability
5. **Use views** for complex reusable queries
6. **Monitor memory** usage with large datasets
7. **Batch operations** when possible
# PouchDB Connector

The PouchDB connector provides integration with PouchDB, a JavaScript database inspired by Apache CouchDB that enables seamless synchronization between local and remote databases.

## Overview

The `PouchDBConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a unified API for PouchDB operations with built-in sync capabilities for offline-first applications.

### Features

- **Offline-First** - Works without internet connection
- **Automatic Sync** - Seamlessly sync with remote databases
- **Cross-Platform** - Works in browsers, Node.js, and mobile apps
- **Replication** - Built-in replication with CouchDB
- **Conflict Resolution** - Automatic conflict handling
- **Attachments** - Support for binary attachments
- **Map/Reduce** - Advanced querying capabilities

## Installation

```bash
npm install @goatlab/fluent-pouchdb pouchdb
```

## Setup

### 1. Initialize PouchDB

```typescript
import PouchDB from 'pouchdb'
import { PouchDBConnector } from '@goatlab/fluent-pouchdb'

// Local database
const db = new PouchDB('myapp')

// Remote database
const remoteDb = new PouchDB('http://localhost:5984/myapp')

// In-memory database (for testing)
const memoryDb = new PouchDB('myapp', { adapter: 'memory' })
```

### 2. Define Your Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users') // This becomes the document type
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

  // PouchDB specific fields
  @f.Column()
  _id?: string

  @f.Column()
  _rev?: string
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
  _id: z.string().optional(),
  _rev: z.string().optional(),
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
import { PouchDBConnector } from '@goatlab/fluent-pouchdb'
import { User, UserInputSchema, UserOutputSchema } from './entities/User'

export class UserRepository extends PouchDBConnector<User, typeof UserInputSchema._type, typeof UserOutputSchema._type> {
  constructor(db: PouchDB.Database) {
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
import PouchDB from 'pouchdb'

// Initialize PouchDB
const db = new PouchDB('myapp')

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

## PouchDB-Specific Features

### Document Revisions

```typescript
// Get document with revision info
const user = await userRepository.findById('user-id', {
  includeRevisions: true
})

console.log('Document revision:', user._rev)

// Update specific revision
await userRepository.updateById('user-id', {
  name: 'Updated Name',
  _rev: user._rev // Required for updates
})
```

### Attachments

```typescript
// Add attachment to document
const user = await userRepository.findById('user-id')

await db.putAttachment('user-id', 'avatar.jpg', user._rev, blob, 'image/jpeg')

// Get attachment
const attachment = await db.getAttachment('user-id', 'avatar.jpg')

// List attachments
const doc = await db.get('user-id', { attachments: true })
console.log('Attachments:', doc._attachments)
```

### Changes Feed

```typescript
// Listen to changes
const changes = db.changes({
  since: 'now',
  live: true,
  include_docs: true
})

changes.on('change', (change) => {
  console.log('Document changed:', change.doc)
})

changes.on('error', (err) => {
  console.error('Changes error:', err)
})

// Stop listening
changes.cancel()
```

### Bulk Operations

```typescript
// Bulk insert/update
const docs = [
  { _id: 'user1', name: 'John', email: 'john@example.com' },
  { _id: 'user2', name: 'Jane', email: 'jane@example.com' }
]

const result = await db.bulkDocs(docs)
console.log('Bulk operation result:', result)
```

## Synchronization

### Basic Sync

```typescript
// One-way sync (local to remote)
const replication = db.sync('http://localhost:5984/myapp', {
  live: true,
  retry: true
})

// Handle sync events
replication.on('change', (change) => {
  console.log('Sync change:', change)
})

replication.on('error', (err) => {
  console.error('Sync error:', err)
})

replication.on('complete', (info) => {
  console.log('Sync complete:', info)
})
```

### Bidirectional Sync

```typescript
// Two-way sync
const sync = db.sync('http://localhost:5984/myapp', {
  live: true,
  retry: true,
  back_off_function: (delay) => {
    return Math.min(delay * 2, 10000) // Exponential backoff
  }
})

// Handle sync status
sync.on('change', (change) => {
  if (change.direction === 'push') {
    console.log('Pushing changes to remote')
  } else if (change.direction === 'pull') {
    console.log('Pulling changes from remote')
  }
})
```

### Filtered Sync

```typescript
// Sync only specific documents
const sync = db.sync('http://localhost:5984/myapp', {
  live: true,
  retry: true,
  filter: (doc) => {
    // Only sync active users
    return doc.type === 'user' && doc.status === 'active'
  }
})
```

### Sync with Authentication

```typescript
// Sync with authentication
const remoteDb = new PouchDB('http://localhost:5984/myapp', {
  auth: {
    username: 'admin',
    password: 'password'
  }
})

const sync = db.sync(remoteDb, {
  live: true,
  retry: true
})
```

## Query Operations

### Basic Queries

```typescript
// Find all documents
const result = await db.allDocs({
  include_docs: true,
  startkey: 'user_',
  endkey: 'user_\ufff0'
})

// Find by key range
const users = await userRepository.findMany({
  where: {
    _id: { 
      startsWith: 'user_',
      endsWith: '_active'
    }
  }
})
```

### Map/Reduce Queries

```typescript
// Create design document with map function
const designDoc = {
  _id: '_design/users',
  views: {
    by_age: {
      map: function(doc) {
        if (doc.type === 'user' && doc.age) {
          emit(doc.age, doc)
        }
      }.toString()
    },
    by_tag: {
      map: function(doc) {
        if (doc.type === 'user' && doc.tags) {
          doc.tags.forEach(tag => {
            emit(tag, doc)
          })
        }
      }.toString()
    }
  }
}

await db.put(designDoc)

// Query view
const result = await db.query('users/by_age', {
  startkey: 18,
  endkey: 65,
  include_docs: true
})
```

### Full-Text Search

```typescript
// Using pouchdb-find plugin
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

// Create index
await db.createIndex({
  index: {
    fields: ['name', 'email']
  }
})

// Search documents
const result = await db.find({
  selector: {
    name: { $regex: /John/i },
    age: { $gte: 18 }
  },
  sort: ['name']
})
```

## Conflict Resolution

### Automatic Conflict Resolution

```typescript
// Handle conflicts automatically
const resolveConflict = async (docId: string) => {
  const doc = await db.get(docId, { conflicts: true })
  
  if (doc._conflicts) {
    // Get conflicting revisions
    const conflicts = await Promise.all(
      doc._conflicts.map(rev => db.get(docId, { rev }))
    )
    
    // Merge conflicts (simple strategy)
    const merged = {
      ...doc,
      name: conflicts.find(c => c.updatedAt > doc.updatedAt)?.name || doc.name,
      _conflicts: undefined
    }
    
    // Update with merged document
    await db.put(merged)
    
    // Remove conflicting revisions
    await Promise.all(
      doc._conflicts.map(rev => db.remove(docId, rev))
    )
  }
}
```

### Custom Conflict Resolution

```typescript
// Custom conflict resolution strategy
const resolveConflicts = async () => {
  const conflicts = await db.allDocs({
    conflicts: true,
    include_docs: true
  })
  
  for (const row of conflicts.rows) {
    if (row.doc._conflicts) {
      const resolved = await customMergeStrategy(row.doc)
      await db.put(resolved)
      
      // Remove conflicting versions
      for (const conflictRev of row.doc._conflicts) {
        await db.remove(row.doc._id, conflictRev)
      }
    }
  }
}

const customMergeStrategy = (doc: any) => {
  // Implement your merge logic here
  return {
    ...doc,
    _conflicts: undefined,
    resolvedAt: new Date()
  }
}
```

## Performance Optimization

### Indexing

```typescript
// Create indexes for better query performance
await db.createIndex({
  index: {
    fields: ['type', 'status', 'createdAt']
  }
})

// Use compound indexes
await db.createIndex({
  index: {
    fields: ['age', 'tags', 'status']
  }
})
```

### Batch Operations

```typescript
// Process documents in batches
const batchSize = 100
const allDocs = await db.allDocs({ include_docs: true })

for (let i = 0; i < allDocs.rows.length; i += batchSize) {
  const batch = allDocs.rows.slice(i, i + batchSize)
  const updates = batch.map(row => ({
    ...row.doc,
    processed: true
  }))
  
  await db.bulkDocs(updates)
}
```

### Memory Management

```typescript
// Compact database to reclaim space
await db.compact()

// Clean up old revisions
await db.compact('users')

// Destroy database when done
await db.destroy()
```

## Offline Support

### Offline Detection

```typescript
// Check if online
const isOnline = navigator.onLine

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Back online - resuming sync')
  sync.resume()
})

window.addEventListener('offline', () => {
  console.log('Gone offline - pausing sync')
  sync.pause()
})
```

### Offline Queue

```typescript
// Queue operations when offline
class OfflineQueue {
  private queue: Array<() => Promise<any>> = []
  private isOnline = navigator.onLine

  async add(operation: () => Promise<any>) {
    if (this.isOnline) {
      return await operation()
    } else {
      this.queue.push(operation)
    }
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const operation = this.queue.shift()!
      try {
        await operation()
      } catch (error) {
        console.error('Failed to process queued operation:', error)
        // Re-queue on failure
        this.queue.unshift(operation)
        break
      }
    }
  }
}
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
  } else if (error.name === 'conflict') {
    // Handle document conflicts
    console.log('Document conflict:', error.message)
  } else if (error.name === 'not_found') {
    // Handle missing documents
    console.log('Document not found:', error.message)
  } else {
    // Handle other PouchDB errors
    console.log('PouchDB error:', error.message)
  }
}
```

## Testing

### In-Memory Testing

```typescript
// test/userRepository.test.ts
import PouchDB from 'pouchdb'
import { UserRepository } from '../src/repositories/UserRepository'

// Use memory adapter for testing
PouchDB.plugin(require('pouchdb-adapter-memory'))

describe('UserRepository', () => {
  let db: PouchDB.Database
  let userRepository: UserRepository

  beforeEach(async () => {
    // Create fresh in-memory database for each test
    db = new PouchDB('test-db', { adapter: 'memory' })
    userRepository = new UserRepository(db)
  })

  afterEach(async () => {
    // Clean up
    await db.destroy()
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

  it('should sync data', async () => {
    const remoteDb = new PouchDB('remote-test-db', { adapter: 'memory' })
    
    // Insert data locally
    await userRepository.insert({
      email: 'john@example.com',
      name: 'John Doe'
    })
    
    // Sync to remote
    await db.sync(remoteDb)
    
    // Check remote has the data
    const remoteUsers = await remoteDb.allDocs({ include_docs: true })
    expect(remoteUsers.rows.length).toBe(1)
    
    await remoteDb.destroy()
  })
})
```

## Best Practices

1. **Use unique IDs** for documents to avoid conflicts
2. **Implement conflict resolution** for collaborative applications
3. **Use indexes** for complex queries
4. **Handle offline scenarios** gracefully
5. **Implement proper error handling** for network issues
6. **Use bulk operations** for better performance
7. **Compact databases** regularly to reclaim space
8. **Monitor sync status** for better user experience
9. **Use views** for complex aggregations
10. **Implement authentication** for secure sync

## Troubleshooting

### Common Issues

1. **Sync Conflicts**: Implement proper conflict resolution
2. **Memory Usage**: Use compact() to reclaim space
3. **Slow Queries**: Add proper indexes
4. **Network Issues**: Handle offline scenarios
5. **Authentication**: Check credentials and permissions

### Debug Mode

```typescript
// Enable debug mode
PouchDB.debug.enable('*')

// Or enable specific components
PouchDB.debug.enable('pouchdb:http')
PouchDB.debug.enable('pouchdb:replication')

// Monitor database info
const info = await db.info()
console.log('Database info:', info)
```

## Migration Strategies

### From CouchDB

```typescript
// Direct sync from CouchDB
const couchDb = new PouchDB('http://localhost:5984/myapp')
const localDb = new PouchDB('myapp')

// Replicate all data
await localDb.replicate.from(couchDb)

// Continue with bidirectional sync
localDb.sync(couchDb, { live: true, retry: true })
```

### From Other Databases

```typescript
// Import from JSON
const importData = async (jsonData: any[]) => {
  const docs = jsonData.map(item => ({
    _id: item.id,
    ...item,
    type: 'user'
  }))
  
  await db.bulkDocs(docs)
}
```

PouchDB provides excellent offline-first capabilities with seamless synchronization, making it ideal for mobile applications and scenarios where network connectivity is unreliable.
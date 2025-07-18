# Connector API Reference

The Fluent ecosystem provides multiple database connectors that implement a common interface for consistent data access across different databases.

## Common Interface

All connectors implement the `FluentConnectorInterface` which provides a consistent API for CRUD operations and relationships.

### Base Connector Methods

All connectors extend `BaseConnector` and provide these common methods:

## TypeORM Connector

The primary connector supporting SQL databases (MySQL, PostgreSQL, SQLite) and MongoDB through TypeORM.

### Constructor

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

const connector = new TypeOrmConnector({
  entity: UserEntity,
  dataSource: dataSource,
  inputSchema: UserInputSchema,
  outputSchema: UserOutputSchema // optional
})
```

**Parameters:**
- `entity` - TypeORM entity class
- `dataSource` - TypeORM DataSource instance
- `inputSchema` - Zod schema for input validation
- `outputSchema` - Optional Zod schema for output validation

### Create Operations

#### `insert(data: InputDTO): Promise<OutputDTO>`

Insert a single record into the database.

```typescript
const user = await userRepository.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
})
```

#### `insertMany(data: InputDTO[]): Promise<OutputDTO[]>`

Insert multiple records in a single operation.

```typescript
const users = await userRepository.insertMany([
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' }
])
```

### Read Operations

#### `findById(id: string, options?: FindByIdFilter): Promise<OutputDTO | null>`

Find a single record by ID.

```typescript
const user = await userRepository.findById('user-123')

// With select
const user = await userRepository.findById('user-123', {
  select: { name: true, email: true }
})

// With relations
const user = await userRepository.findById('user-123', {
  include: { posts: true }
})
```

#### `findByIds(ids: string[], options?: FindByIdFilter): Promise<OutputDTO[]>`

Find multiple records by IDs.

```typescript
const users = await userRepository.findByIds(['user-1', 'user-2', 'user-3'])

// With options
const users = await userRepository.findByIds(['user-1', 'user-2'], {
  select: { name: true, email: true },
  limit: 10
})
```

#### `findMany(query?: FluentQuery): Promise<OutputDTO[]>`

Find multiple records with advanced query options.

```typescript
const users = await userRepository.findMany({
  where: { age: { gte: 18 } },
  orderBy: [{ name: 'asc' }],
  limit: 10,
  offset: 20
})

// Complex queries
const users = await userRepository.findMany({
  where: {
    OR: [
      { age: { gte: 18 } },
      { role: 'admin' }
    ]
  },
  include: { posts: { select: { title: true } } }
})
```

#### `findFirst(query?: FluentQuery): Promise<OutputDTO | null>`

Find the first record matching the query.

```typescript
const user = await userRepository.findFirst({
  where: { email: 'john@example.com' },
  include: { profile: true }
})
```

#### `requireById(id: string, options?: FindByIdFilter): Promise<OutputDTO>`

Find a record by ID or throw an error if not found.

```typescript
try {
  const user = await userRepository.requireById('user-123')
} catch (error) {
  // Error: Object user-123 not found
}
```

#### `requireFirst(query?: FluentQuery): Promise<OutputDTO>`

Find the first record matching the query or throw an error.

```typescript
const user = await userRepository.requireFirst({
  where: { email: 'john@example.com' }
})
```

### Update Operations

#### `updateById(id: string, data: InputDTO): Promise<OutputDTO>`

Update a record by ID.

```typescript
const updatedUser = await userRepository.updateById('user-123', {
  name: 'John Updated',
  age: 31
})
```

#### `replaceById(id: string, data: InputDTO): Promise<OutputDTO>`

Replace a record completely by ID.

```typescript
const replacedUser = await userRepository.replaceById('user-123', {
  name: 'John Replaced',
  email: 'john.new@example.com',
  age: 32
})
```

### Delete Operations

#### `deleteById(id: string): Promise<string>`

Delete a record by ID.

```typescript
const deletedId = await userRepository.deleteById('user-123')
```

### Utility Methods

#### `collect(query?: FluentQuery): Promise<Collection<OutputDTO>>`

Get results as a Collection for advanced manipulation.

```typescript
const users = await userRepository.collect({
  where: { age: { gte: 18 } }
})

const names = users.pluck('name')
const grouped = users.groupBy('age')
```

#### `pluck(field: string, query?: FluentQuery): Promise<Primitives[]>`

Extract values from a specific field.

```typescript
const names = await userRepository.pluck('name', {
  where: { active: true }
})
```

### Relationship Methods

#### `hasMany(config): Repository`

Define a one-to-many relationship.

```typescript
// In UserRepository
posts() {
  return this.hasMany({
    repository: PostRepository,
    entity: PostEntity
  })
}

// Usage
const user = await userRepository.loadById('user-123')
const posts = await user.posts().findMany()
```

#### `belongsTo(config): Repository`

Define a many-to-one relationship.

```typescript
// In PostRepository
user() {
  return this.belongsTo({
    repository: UserRepository,
    entity: UserEntity
  })
}
```

#### `belongsToMany(config): Repository`

Define a many-to-many relationship.

```typescript
// In UserRepository
roles() {
  return this.belongsToMany({
    repository: RoleRepository,
    entity: RoleEntity,
    pivot: UserRoleRepository
  })
}

// Usage
const user = await userRepository.loadById('user-123')
await user.roles().attach('role-456')
```

#### `associate(data): Promise<OutputDTO[]>`

Associate records in a one-to-many relationship.

```typescript
const user = await userRepository.loadById('user-123')
const posts = await user.posts().associate([
  { title: 'First Post' },
  { title: 'Second Post' }
])
```

#### `attach(id: string, pivot?: object): Promise<any[]>`

Attach records in a many-to-many relationship.

```typescript
const user = await userRepository.loadById('user-123')
await user.roles().attach('role-456', { 
  created_at: new Date(),
  permissions: ['read', 'write']
})
```

## Firebase Connector

Connector for Firebase Firestore databases.

### Constructor

```typescript
import { FirebaseConnector } from '@goatlab/fluent-firebase'

const connector = new FirebaseConnector({
  entity: UserEntity,
  inputSchema: UserInputSchema,
  outputSchema: UserOutputSchema
})
```

### Firebase-Specific Features

#### Real-time Updates

```typescript
// Listen to document changes
const unsubscribe = userRepository.onSnapshot('user-123', (user) => {
  console.log('User updated:', user)
})

// Listen to collection changes
const unsubscribe = userRepository.onCollectionSnapshot({
  where: { active: true }
}, (users) => {
  console.log('Active users:', users)
})
```

#### Batch Operations

```typescript
const batch = userRepository.batch()
batch.insert({ name: 'User 1' })
batch.insert({ name: 'User 2' })
batch.updateById('user-123', { name: 'Updated' })
await batch.commit()
```

## Loki Connector

In-memory JavaScript database connector using LokiJS.

### Constructor

```typescript
import { LokiConnector } from '@goatlab/fluent-loki'

const connector = new LokiConnector({
  entity: UserEntity,
  inputSchema: UserInputSchema,
  outputSchema: UserOutputSchema
})
```

### Loki-Specific Features

#### Persistence

```typescript
// Save to file
await userRepository.save('users.db')

// Load from file
await userRepository.load('users.db')
```

#### Indexing

```typescript
// Create index for better performance
userRepository.createIndex('email')
```

## PouchDB Connector

Connector for PouchDB (CouchDB-compatible) databases.

### Constructor

```typescript
import { PouchDBConnector } from '@goatlab/fluent-pouchdb'

const connector = new PouchDBConnector({
  entity: UserEntity,
  inputSchema: UserInputSchema,
  outputSchema: UserOutputSchema
})
```

### PouchDB-Specific Features

#### Synchronization

```typescript
// Sync with remote CouchDB
await userRepository.sync('http://localhost:5984/users')

// Continuous sync
const replication = userRepository.continuousSync('http://localhost:5984/users')
```

#### Conflict Resolution

```typescript
// Handle conflicts
const conflicts = await userRepository.getConflicts('user-123')
await userRepository.resolveConflict('user-123', winningRevision)
```

## Form.io Connector

Connector for Form.io API integration.

### Constructor

```typescript
import { FormioConnector } from '@goatlab/fluent-formio'

const connector = new FormioConnector({
  entity: FormEntity,
  inputSchema: FormInputSchema,
  outputSchema: FormOutputSchema,
  baseUrl: 'https://formio.example.com',
  projectId: 'your-project-id'
})
```

### Form.io-Specific Features

#### Form Management

```typescript
// Create form
const form = await formRepository.createForm({
  title: 'User Registration',
  components: [
    { type: 'textfield', key: 'name', label: 'Name' },
    { type: 'email', key: 'email', label: 'Email' }
  ]
})

// Submit form data
const submission = await formRepository.submitForm('form-id', {
  data: { name: 'John', email: 'john@example.com' }
})
```

## Query Interface

All connectors support the same query interface:

### Where Conditions

```typescript
// Basic conditions
{ where: { name: 'John' } }

// Operators
{ where: { age: { gte: 18, lte: 65 } } }

// Arrays
{ where: { id: { in: ['1', '2', '3'] } } }

// Logical operators
{ where: { 
  OR: [
    { age: { gte: 18 } },
    { role: 'admin' }
  ]
}}
```

### Select Fields

```typescript
// Select specific fields
{ select: { name: true, email: true } }

// Nested selection
{ select: { 
  name: true, 
  profile: { 
    avatar: true, 
    bio: true 
  } 
}}
```

### Ordering

```typescript
// Single field
{ orderBy: [{ name: 'asc' }] }

// Multiple fields
{ orderBy: [{ name: 'asc' }, { age: 'desc' }] }
```

### Pagination

```typescript
// Limit and offset
{ limit: 10, offset: 20 }

// Paginated results
{ 
  limit: 10, 
  paginated: { 
    page: 1, 
    perPage: 10 
  } 
}
```

### Including Relations

```typescript
// Include all relation data
{ include: { posts: true } }

// Include with conditions
{ include: { 
  posts: { 
    where: { published: true },
    select: { title: true, content: true }
  } 
}}

// Include with pivot data
{ include: { 
  roles: { 
    withPivot: true 
  } 
}}
```

## Error Handling

All connectors provide consistent error handling:

```typescript
try {
  const user = await userRepository.requireById('non-existent')
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle not found
  }
}
```

## Performance Considerations

1. **Indexing**: Create indexes on frequently queried fields
2. **Batch Operations**: Use batch operations for multiple changes
3. **Select Fields**: Only select fields you need
4. **Pagination**: Use pagination for large datasets
5. **Caching**: Implement caching for frequently accessed data

## Related Documentation

- [Fluent API](./fluent-api.md) - Main Fluent class
- [Type Definitions](./types.md) - TypeScript types
- [Basic Examples](../examples/basic-queries.md) - Basic query examples
- [Relationship Examples](../examples/relations.md) - Working with relationships
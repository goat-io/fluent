# LokiJS Advanced Guide

This guide covers advanced usage patterns, implementation details, and internal workings of the LokiJS connector.

## Architecture

### Connector Implementation

The `LokiConnector` class extends `BaseConnector` and implements the full `FluentConnectorInterface`. Key architectural decisions:

1. **Automatic Collection Management** - Collections are created automatically if they don't exist
2. **Schema Validation** - Input and output schemas are validated using Zod
3. **Type Safety** - Full TypeScript generics support for ModelDTO, InputDTO, and OutputDTO
4. **Relation Support** - Integrates with Fluent's relation system via `modelGeneratorDataSource`

### Storage Architecture

The `Loki` helper class provides a factory for creating databases with different storage adapters:

```typescript
export class LokiClass {
  public createDb<T extends LokiParams>({
    dbName,
    storage,
    secret
  }: LokiCreateParams<T>): LokiJS
}
```

Each storage type has specific configurations:

- **Memory**: Uses `LokiMemoryAdapter` with async responses
- **IndexedDB**: Uses `LokiIndexedAdapter` with partitioning
- **File**: Default file-based persistence
- **FS Structured**: Uses `loki-fs-structured-adapter`
- **Encrypted**: Requires secret, uses `loki-crypted-file-adapter`
- **JSON**: Uses `LokiNativescriptAdapter` for mobile

## Query Translation

### Where Clause Translation

The `getLokiWhere` method translates Fluent query syntax to LokiJS format:

1. **Root Level Conditions** - Applied directly
2. **AND Conditions** - Grouped under `$and` array
3. **OR Conditions** - Grouped under `$or` array
4. **Nested Properties** - Converted to dot notation

### Operator Mapping

```typescript
// Fluent -> LokiJS operator mapping
LogicOperator.equals -> $eq
LogicOperator.isNot -> $neq
LogicOperator.greaterThan -> $gt
LogicOperator.greaterOrEqualThan -> $gte
LogicOperator.lessThan -> $lt
LogicOperator.lessOrEqualThan -> $lte
LogicOperator.in -> $in
LogicOperator.notIn -> $not: { $in: value }
LogicOperator.exists -> $exists: true
LogicOperator.notExists -> $exists: false
LogicOperator.regexp -> $regex
```

### Complex Query Examples

```typescript
// Nested AND/OR conditions
const users = await repo.findMany({
  where: {
    AND: [
      { status: 'active' },
      { age: { gte: 18 } }
    ],
    OR: [
      { role: 'admin' },
      { permissions: { in: ['super_user'] } }
    ]
  }
})

// Translates to LokiJS:
{
  $or: [
    {
      $and: [
        { status: { $eq: 'active' } },
        { age: { $gte: 18 } },
        { role: { $eq: 'admin' } }
      ]
    },
    {
      $and: [
        { status: { $eq: 'active' } },
        { age: { $gte: 18 } },
        { permissions: { $in: ['super_user'] } }
      ]
    }
  ]
}
```

## Data Transformation

### Insert Operations

1. **ID Generation** - Uses `Ids.uuid()` for new records
2. **Timestamp Addition** - Adds `created`, `createdAt`, `updatedAt`
3. **Schema Validation** - Validates input against schema
4. **Empty/Null Cleanup** - Removes empty values before returning

### Update Operations

1. **Partial Validation** - Uses `.partial()` on schema
2. **Timestamp Update** - Adds `updated` field if present in entity
3. **Modified Tracking** - Adds `modified` ISO timestamp
4. **Metadata Preservation** - Keeps LokiJS internal fields

### Replace Operations

1. **Null Object Creation** - Creates null template from existing document
2. **Field Replacement** - Replaces all user fields, preserves system fields
3. **LokiJS Metadata** - Preserves `$loki` and `meta` fields
4. **Partial Output** - Uses partial schema for validation

## Performance Optimization

### Query Optimization

```typescript
// Efficient query building
const baseQuery = this.collection
  .chain()
  .find(where)
  
// Pagination applied before sorting
if (query?.paginated) {
  baseQuery.limit(query.paginated.perPage)
  baseQuery.offset((query.paginated.page - 1) * query.paginated.perPage)
}

// Compound sorting for multiple fields
if (query?.orderBy) {
  const sort: [string, boolean][] = []
  for (const order of query.orderBy) {
    const flattenObject = Objects.flatten(order)
    for (const attribute of Object.keys(flattenObject)) {
      const isDescending = flattenObject[attribute] === 'desc'
      sort.push([attribute, isDescending])
    }
  }
  baseQuery = baseQuery.compoundsort(sort)
}
```

### Memory Management

1. **Default Limits** - Applies default limit of 10 if not specified
2. **Cleanup Operations** - Uses `Objects.clearEmpties` and `Objects.deleteNulls`
3. **Clone Prevention** - Uses detached instances for loadFirst operations

## Advanced Patterns

### Relation Loading

```typescript
// Load relations using loadFirst
const userWithPosts = repo.loadFirst({
  where: { id: userId }
})

// Set related query
repo.setRelatedQuery({
  entity: User,
  repository: repo,
  query: { where: { status: 'active' } }
})
```

### Custom Repository Methods

```typescript
export class AdvancedUserRepository extends LokiConnector<User, UserInput, UserOutput> {
  // Find users by email domain
  async findByEmailDomain(domain: string) {
    return this.findMany({
      where: {
        email: { regexp: `.*@${domain}$` }
      }
    })
  }
  
  // Bulk status update
  async bulkUpdateStatus(userIds: string[], status: string) {
    const collection = this.raw()
    const users = collection.find({ id: { $in: userIds } })
    
    users.forEach(user => {
      user.status = status
      user.updatedAt = new Date()
      collection.update(user)
    })
    
    return users.length
  }
  
  // Complex aggregation
  async getUserStats() {
    const collection = this.raw()
    const allUsers = collection.find({})
    
    return {
      total: allUsers.length,
      active: allUsers.filter(u => u.status === 'active').length,
      averageAge: allUsers.reduce((sum, u) => sum + (u.age || 0), 0) / allUsers.length
    }
  }
}
```

### Working with Views

```typescript
// Create reusable views
const repo = new LokiConnector({ ... })
const collection = repo.raw()

// Active users view
const activeView = collection.addDynamicView('active')
activeView
  .applyFind({ status: 'active' })
  .applyWhere((obj) => obj.emailVerified === true)
  .applySimpleSort('createdAt', true)

// Premium users view  
const premiumView = collection.addDynamicView('premium')
premiumView
  .applyFind({ subscription: { $in: ['pro', 'enterprise'] } })
  .applyWhere((obj) => {
    const expiryDate = new Date(obj.subscriptionExpiry)
    return expiryDate > new Date()
  })

// Use views in queries
const activeUsers = activeView.data()
const premiumUsers = premiumView.data()
```

### Error Handling Patterns

```typescript
// Graceful degradation for validation errors
const validatedResults = found.map(item => {
  try {
    return this.outputSchema.parse(item)
  } catch (e) {
    // If full validation fails, try partial validation
    return (this.outputSchema as any).partial().parse(item)
  }
})

// Handle missing collections
if (!dbModels.includes(entity.name)) {
  dataSource.addCollection(entity.name)
}

// Safe pluck operation
public async pluck(path: any, query?: FluentQuery<ModelDTO>): Promise<Primitives[]> {
  const data = await this.findMany(query)
  const result: Primitives[] = []
  
  for (const item of data as any[]) {
    const extracted = Objects.getFromPath(item, String(pathKey), undefined)
    if (typeof extracted.value !== 'undefined') {
      result.push(extracted.value)
    }
  }
  
  return result
}
```

## Testing Strategies

### Mock Data Generation

```typescript
import { faker } from '@faker-js/faker'

export function generateMockUsers(count: number) {
  return Array.from({ length: count }, () => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 80 }),
    tags: faker.helpers.arrayElements(['developer', 'designer', 'manager', 'admin'], { min: 1, max: 3 }),
    address: {
      city: faker.location.city(),
      country: faker.location.country()
    }
  }))
}
```

### Performance Testing

```typescript
describe('LokiConnector Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const users = generateMockUsers(10000)
    
    console.time('bulk-insert')
    await repo.insertMany(users)
    console.timeEnd('bulk-insert')
    
    console.time('complex-query')
    const results = await repo.findMany({
      where: {
        AND: [
          { age: { gte: 25, lte: 50 } },
          { tags: { in: ['developer'] } }
        ]
      },
      orderBy: [{ age: 'desc' }, { name: 'asc' }],
      limit: 100
    })
    console.timeEnd('complex-query')
    
    expect(results.length).toBeLessThanOrEqual(100)
  })
})
```

### Integration Testing

```typescript
describe('LokiConnector Integration', () => {
  let db: LokiJS
  let userRepo: LokiConnector<User, UserInput, UserOutput>
  let postRepo: LokiConnector<Post, PostInput, PostOutput>
  
  beforeEach(() => {
    db = Loki.createDb({
      dbName: 'test',
      storage: LokiStorageType.memory
    })
    
    userRepo = new LokiConnector({
      entity: { name: 'users' },
      dataSource: db,
      inputSchema: UserSchema,
      outputSchema: UserSchema
    })
    
    postRepo = new LokiConnector({
      entity: { name: 'posts' },
      dataSource: db,
      inputSchema: PostSchema,
      outputSchema: PostSchema
    })
  })
  
  it('should handle cross-collection queries', async () => {
    // Create user
    const user = await userRepo.insert({
      name: 'John Doe',
      email: 'john@example.com'
    })
    
    // Create posts
    await postRepo.insertMany([
      { title: 'Post 1', authorId: user.id },
      { title: 'Post 2', authorId: user.id }
    ])
    
    // Query posts by author
    const userPosts = await postRepo.findMany({
      where: { authorId: user.id }
    })
    
    expect(userPosts).toHaveLength(2)
  })
})
```

## Debugging

### Enable Verbose Logging

```typescript
// Create debug wrapper
class DebugLokiConnector<M, I, O> extends LokiConnector<M, I, O> {
  async findMany<T extends FluentQuery<M>>(query?: T) {
    console.log('Query:', JSON.stringify(query, null, 2))
    const lokiWhere = this.getLokiWhere(query?.where)
    console.log('LokiJS Where:', JSON.stringify(lokiWhere, null, 2))
    
    const results = await super.findMany(query)
    console.log('Results count:', results.length)
    
    return results
  }
}
```

### Query Analysis

```typescript
// Analyze query performance
const collection = repo.raw()

// Get collection statistics
console.log('Collection stats:', {
  count: collection.count(),
  maxId: collection.maxId,
  data: collection.data.length,
  indexes: collection.binaryIndices
})

// Analyze specific query
const query = { age: { $gte: 25 }, status: { $eq: 'active' } }
console.time('query-execution')
const results = collection.find(query)
console.timeEnd('query-execution')
console.log('Query matched:', results.length, 'documents')
```

## Migration Guide

### From Raw LokiJS

```typescript
// Before: Raw LokiJS
const db = new Loki('app.db')
const users = db.addCollection('users')
users.insert({ name: 'John', email: 'john@example.com' })
const found = users.find({ name: 'John' })

// After: Fluent LokiJS
const db = Loki.createDb({ dbName: 'app', storage: LokiStorageType.memory })
const users = new LokiConnector({
  entity: { name: 'users' },
  dataSource: db,
  inputSchema: UserSchema,
  outputSchema: UserSchema
})
await users.insert({ name: 'John', email: 'john@example.com' })
const found = await users.findMany({ where: { name: 'John' } })
```

### From Other Fluent Connectors

```typescript
// The API is identical across connectors
// Only the initialization changes:

// TypeORM
const users = new TypeOrmConnector({
  entity: User,
  dataSource: typeormDataSource,
  inputSchema: UserSchema
})

// LokiJS
const users = new LokiConnector({
  entity: User,
  dataSource: lokiDb,
  inputSchema: UserSchema
})

// Same queries work for both
const activeUsers = await users.findMany({
  where: { status: 'active' },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})
```

## Common Pitfalls

1. **Collection Names** - Entity name must match collection name
2. **Async Operations** - All operations return Promises
3. **Schema Validation** - Ensure schemas match your data structure
4. **Memory Limits** - Monitor memory usage with large datasets
5. **Persistence Timing** - Configure autosave intervals appropriately
6. **Index Usage** - Not all operators use indexes efficiently
7. **Nested Updates** - Deep updates require full object replacement
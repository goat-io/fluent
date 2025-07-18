# Base Connector

The BaseConnector is the abstract foundation for all database connectors in Fluent. It provides the core functionality and interface that all specific connectors (TypeORM, Firebase, PouchDB, etc.) extend to implement database-specific operations.

## Overview

The BaseConnector provides:
- **Common Query Methods**: Standard CRUD operations across all connectors
- **Type Safety**: Generic types for models, inputs, and outputs
- **Relationship Management**: Methods for handling data relationships
- **Collection Operations**: Integration with Fluent collections
- **Data Validation**: Input/output validation hooks
- **Query Optimization**: Caching and performance optimization

## Class Definition

```typescript
export abstract class BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  protected outputKeys: string[]
  protected relatedQuery?: {
    entity: new () => ModelDTO
    query?: FluentQuery<ModelDTO>
    repository?: any
    key?: string
    pivot?: any
  }
  protected modelRelations: any
  public isMongoDB: boolean
  
  // Abstract methods that must be implemented by subclasses
  public abstract findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]>
  
  public abstract insertMany(data: InputDTO[]): Promise<OutputDTO[]>
  public abstract updateById(id: string, data: InputDTO): Promise<OutputDTO>
}
```

## Generic Type Parameters

The BaseConnector uses three generic type parameters:

- **ModelDTO**: The entity/model type representing the database structure
- **InputDTO**: The input type for create/update operations
- **OutputDTO**: The output type for read operations

```typescript
// Example usage
class UserRepository extends BaseConnector<User, CreateUserDTO, UserDTO> {
  // Implementation specific to User entity
}
```

## Core Methods

### Query Methods

#### `findMany(query?)`

Finds multiple records matching the query criteria.

```typescript
async findMany<T extends FluentQuery<ModelDTO>>(
  query?: T
): Promise<QueryOutput<T, ModelDTO>[]>
```

**Parameters:**
- `query`: Optional query object with where, select, include, orderBy, limit, etc.

**Returns:** Array of records matching the query

**Example:**
```typescript
const users = await userRepo.findMany({
  where: { isActive: true },
  select: { id: true, email: true, name: true },
  orderBy: [{ createdAt: 'desc' }],
  limit: 10
})
```

#### `findFirst(query?)`

Finds the first record matching the query criteria.

```typescript
async findFirst<T extends FluentQuery<ModelDTO>>(
  query?: T
): Promise<QueryOutput<T, ModelDTO> | null>
```

**Example:**
```typescript
const user = await userRepo.findFirst({
  where: { email: 'john@example.com' }
})
```

#### `findById(id, query?)`

Finds a record by its ID.

```typescript
async findById<T extends FindByIdFilter<ModelDTO>>(
  id: string,
  query?: T
): Promise<QueryOutput<T, ModelDTO> | null>
```

**Example:**
```typescript
const user = await userRepo.findById('user-123', {
  select: { id: true, email: true, name: true }
})
```

#### `findByIds(ids, query?)`

Finds multiple records by their IDs.

```typescript
async findByIds<T extends FindByIdFilter<ModelDTO>>(
  ids: string[],
  query?: T
): Promise<QueryOutput<T, ModelDTO>[]>
```

**Example:**
```typescript
const users = await userRepo.findByIds(['user-1', 'user-2', 'user-3'], {
  select: { id: true, email: true, name: true }
})
```

### Require Methods

#### `requireById(id, query?)`

Finds a record by ID or throws an error if not found.

```typescript
async requireById(
  id: string,
  query?: FindByIdFilter<ModelDTO>
): Promise<QueryOutput<FindByIdFilter<ModelDTO>, ModelDTO>>
```

**Example:**
```typescript
try {
  const user = await userRepo.requireById('user-123')
  // User is guaranteed to exist
} catch (error) {
  // Handle not found error
  console.error('User not found:', error.message)
}
```

#### `requireFirst(query?)`

Finds the first record matching the query or throws an error if not found.

```typescript
async requireFirst<T extends FluentQuery<ModelDTO>>(
  query?: T
): Promise<QueryOutput<T, ModelDTO>>
```

**Example:**
```typescript
try {
  const admin = await userRepo.requireFirst({
    where: { role: 'admin' }
  })
  // Admin user is guaranteed to exist
} catch (error) {
  console.error('No admin user found:', error.message)
}
```

### Data Manipulation Methods

#### `insertMany(data)`

Inserts multiple records.

```typescript
abstract async insertMany(data: InputDTO[]): Promise<OutputDTO[]>
```

**Example:**
```typescript
const users = await userRepo.insertMany([
  { email: 'john@example.com', name: 'John Doe' },
  { email: 'jane@example.com', name: 'Jane Smith' }
])
```

#### `updateById(id, data)`

Updates a record by ID.

```typescript
abstract async updateById(id: string, data: InputDTO): Promise<OutputDTO>
```

**Example:**
```typescript
const updatedUser = await userRepo.updateById('user-123', {
  name: 'John Smith',
  age: 31
})
```

### Collection Methods

#### `collect(query)`

Converts query results to a Collection for advanced operations.

```typescript
async collect(
  query: FluentQuery<ModelDTO>
): Promise<Collection<OutputDTO>>
```

**Example:**
```typescript
const userCollection = await userRepo.collect({
  where: { isActive: true }
})

const averageAge = userCollection.avg('age')
const totalUsers = userCollection.count()
const usersByRole = userCollection.groupBy('role')
```

#### `pluck(path, query?)`

Extracts values for a specific field from multiple records.

```typescript
async pluck(
  path: QueryFieldSelector<ModelDTO>,
  query?: FluentQuery<ModelDTO>
): Promise<Primitives[]>
```

**Example:**
```typescript
const userEmails = await userRepo.pluck('email', {
  where: { isActive: true }
})
// Returns: ['john@example.com', 'jane@example.com', ...]
```

## Relationship Methods

The BaseConnector provides methods for managing relationships between entities.

### `hasMany(params)`

Defines a one-to-many relationship.

```typescript
protected hasMany<T extends FluentHasManyParams<T>>(
  params: T
): InstanceType<T['repository']>
```

**Example:**
```typescript
class UserRepository extends BaseConnector<User, CreateUserDTO, UserDTO> {
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
```

### `belongsTo(params)`

Defines a belongs-to (inverse one-to-many) relationship.

```typescript
protected belongsTo<T extends FluentBelongsToParams<T>>(
  params: T
): InstanceType<T['repository']>
```

**Example:**
```typescript
class PostRepository extends BaseConnector<Post, CreatePostDTO, PostDTO> {
  author() {
    return this.belongsTo({
      repository: UserRepository,
      entity: () => User
    })
  }
}
```

### `belongsToMany(params)`

Defines a many-to-many relationship.

```typescript
protected belongsToMany<T extends FluentBelongsToManyParams<T>>(
  params: T
): InstanceType<T['repository']>
```

**Example:**
```typescript
class UserRepository extends BaseConnector<User, CreateUserDTO, UserDTO> {
  roles() {
    return this.belongsToMany({
      repository: RoleRepository,
      entity: () => Role,
      pivot: UserRoleRepository
    })
  }
}
```

### `associate(data)`

Associates data with a parent entity in a one-to-many relationship.

```typescript
async associate(data: InputDTO | OutputDTO): Promise<OutputDTO[]>
```

**Example:**
```typescript
// Find users and associate posts with them
const users = await userRepo.findMany({ where: { isActive: true } })
const postRepo = userRepo.posts()

const newPosts = await postRepo.associate({
  title: 'New Post',
  content: 'Post content...'
})
```

### `attach(id, pivot?)`

Attaches a record in a many-to-many relationship with optional pivot data.

```typescript
async attach(id: string, pivot?: AnyObject): Promise<any[]>
```

**Example:**
```typescript
// Find users and attach roles to them
const users = await userRepo.findMany({ where: { isActive: true } })
const roleRepo = userRepo.roles()

await roleRepo.attach('admin-role-id', {
  assignedAt: new Date(),
  assignedBy: 'admin-user-id'
})
```

## Data Processing Methods

### `jsApplySelect(select, data)`

Applies field selection to data when database doesn't support it natively.

```typescript
protected jsApplySelect(
  select: FluentQuery<ModelDTO>['select'],
  data: ModelDTO[]
): ModelDTO[]
```

This method is used internally to filter fields when the database connector doesn't support field selection natively.

## Creating Custom Connectors

To create a custom connector, extend the BaseConnector and implement the required abstract methods:

```typescript
import { BaseConnector } from '@goatlab/fluent'
import { FluentConnectorInterface } from '@goatlab/fluent'

export class CustomConnector<ModelDTO, InputDTO, OutputDTO>
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
  implements FluentConnectorInterface<ModelDTO, InputDTO, OutputDTO>
{
  private client: any // Your database client

  constructor(client: any) {
    super()
    this.client = client
  }

  // Implement required abstract methods
  async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    // Your implementation
    // Convert FluentQuery to your database's query format
    // Execute query and return results
  }

  async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    // Your implementation
    // Insert multiple records
    // Return inserted records
  }

  async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    // Your implementation
    // Update record by ID
    // Return updated record
  }

  // Implement other required methods
  async insert(data: InputDTO): Promise<OutputDTO> {
    const results = await this.insertMany([data])
    return results[0]
  }

  async deleteById(id: string): Promise<void> {
    // Your implementation
  }

  async count(query?: FluentQuery<ModelDTO>): Promise<number> {
    // Your implementation
  }
}
```

## Example: Redis Connector

Here's an example of a simple Redis connector:

```typescript
import Redis from 'ioredis'
import { BaseConnector } from '@goatlab/fluent'

export class RedisConnector<ModelDTO, InputDTO, OutputDTO>
  extends BaseConnector<ModelDTO, InputDTO, OutputDTO>
{
  private redis: Redis
  private keyPrefix: string

  constructor(redis: Redis, keyPrefix: string) {
    super()
    this.redis = redis
    this.keyPrefix = keyPrefix
  }

  async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const pattern = `${this.keyPrefix}:*`
    const keys = await this.redis.keys(pattern)
    
    const results = await Promise.all(
      keys.map(key => this.redis.get(key))
    )

    let data = results
      .filter(result => result !== null)
      .map(result => JSON.parse(result))

    // Apply query filters
    if (query?.where) {
      data = this.applyWhereConditions(data, query.where)
    }

    if (query?.orderBy) {
      data = this.applyOrderBy(data, query.orderBy)
    }

    if (query?.limit) {
      data = data.slice(0, query.limit)
    }

    if (query?.select) {
      data = this.jsApplySelect(query.select, data)
    }

    return data as QueryOutput<T, ModelDTO>[]
  }

  async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
    const results = await Promise.all(
      data.map(async (item, index) => {
        const id = `${this.keyPrefix}:${Date.now()}-${index}`
        const record = { ...item, id }
        await this.redis.set(id, JSON.stringify(record))
        return record as OutputDTO
      })
    )

    return results
  }

  async updateById(id: string, data: InputDTO): Promise<OutputDTO> {
    const key = `${this.keyPrefix}:${id}`
    const existing = await this.redis.get(key)
    
    if (!existing) {
      throw new Error(`Record with id ${id} not found`)
    }

    const record = { ...JSON.parse(existing), ...data }
    await this.redis.set(key, JSON.stringify(record))
    
    return record as OutputDTO
  }

  // Helper methods
  private applyWhereConditions(data: any[], where: any): any[] {
    // Implementation for filtering data based on where conditions
    return data.filter(item => {
      // Your filtering logic here
      return true
    })
  }

  private applyOrderBy(data: any[], orderBy: any[]): any[] {
    // Implementation for sorting data
    return data.sort((a, b) => {
      // Your sorting logic here
      return 0
    })
  }
}
```

## Best Practices

### 1. Type Safety

Always use proper generic types:

```typescript
// ✅ Good
class UserRepository extends BaseConnector<User, CreateUserDTO, UserDTO> {
  // Implementation
}

// ❌ Bad
class UserRepository extends BaseConnector<any, any, any> {
  // Implementation
}
```

### 2. Error Handling

Implement proper error handling:

```typescript
async findMany<T extends FluentQuery<ModelDTO>>(
  query?: T
): Promise<QueryOutput<T, ModelDTO>[]> {
  try {
    // Your implementation
  } catch (error) {
    console.error('Database query failed:', error)
    throw new Error('Failed to fetch records')
  }
}
```

### 3. Data Validation

Validate input data before processing:

```typescript
async insertMany(data: InputDTO[]): Promise<OutputDTO[]> {
  // Validate input data
  for (const item of data) {
    if (!this.validateInput(item)) {
      throw new Error('Invalid input data')
    }
  }
  
  // Process data
  return this.processInsert(data)
}
```

### 4. Performance Optimization

Implement caching and optimization:

```typescript
import { Cache } from '@goatlab/js-utils'

class MyConnector extends BaseConnector<ModelDTO, InputDTO, OutputDTO> {
  private cache = new Cache<OutputDTO[]>()

  async findMany<T extends FluentQuery<ModelDTO>>(
    query?: T
  ): Promise<QueryOutput<T, ModelDTO>[]> {
    const cacheKey = this.getCacheKey(query)
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const results = await this.executeQuery(query)
    this.cache.set(cacheKey, results, 5 * 60 * 1000) // 5 minutes
    
    return results
  }
}
```

## Testing Custom Connectors

```typescript
import { BaseConnector } from '@goatlab/fluent'

describe('CustomConnector', () => {
  let connector: CustomConnector<User, CreateUserDTO, UserDTO>

  beforeEach(() => {
    connector = new CustomConnector(mockClient)
  })

  test('should implement BaseConnector interface', () => {
    expect(connector).toBeInstanceOf(BaseConnector)
  })

  test('should find records', async () => {
    const users = await connector.findMany({
      where: { isActive: true }
    })
    
    expect(Array.isArray(users)).toBe(true)
  })

  test('should insert records', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User'
    }

    const user = await connector.insertMany([userData])
    expect(user[0]).toBeDefined()
    expect(user[0].email).toBe(userData.email)
  })
})
```

## Related Documentation

- **[TypeORM Connector](typeorm-connector.md)** - Most common connector implementation
- **[Fluent Class](fluent-class.md)** - Main entry point
- **[Query Builder](query-builder.md)** - Understanding query structure
- **[Entities](entities.md)** - Entity definitions and relationships

The BaseConnector provides a solid foundation for building database connectors while maintaining consistency across different database systems. Its flexible design allows for easy extension while ensuring type safety and performance optimization.
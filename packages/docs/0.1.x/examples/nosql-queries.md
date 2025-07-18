# NoSQL Database Query Examples

This guide provides comprehensive examples of NoSQL database operations using Firebase, MongoDB, LokiJS, and PouchDB connectors in Goat Fluent.

## Firebase Firestore Examples

### Entity Definition

```typescript
// entities/User.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users')
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

  @Column()
  @f.Column()
  tags: string[]

  @Column()
  @f.Column()
  profile: {
    bio?: string
    avatar?: string
    preferences?: Record<string, any>
  }

  @Column({ type: 'timestamp' })
  @f.Column()
  createdAt: Date

  @Column({ type: 'timestamp' })
  @f.Column()
  updatedAt: Date
}

export const UserInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  age: z.number().min(0).max(150),
  status: z.enum(['active', 'inactive', 'pending']).default('pending'),
  tags: z.array(z.string()).default([]),
  profile: z.object({
    bio: z.string().optional(),
    avatar: z.string().optional(),
    preferences: z.record(z.any()).optional()
  }).default({})
})

export const UserOutputSchema = UserInputSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
})
```

### Firebase Repository Setup

```typescript
// repositories/FirebaseUserRepository.ts
import { FirebaseConnector } from '@goatlab/fluent-firebase'
import { User, UserInputSchema, UserOutputSchema } from '../entities/User'

export class FirebaseUserRepository extends FirebaseConnector<
  User,
  typeof UserInputSchema._type,
  typeof UserOutputSchema._type
> {
  constructor() {
    super({
      entity: User,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### Firebase CRUD Operations

```typescript
const userRepository = new FirebaseUserRepository()

// Create user
const newUser = await userRepository.insert({
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  age: 30,
  status: 'active',
  tags: ['developer', 'javascript'],
  profile: {
    bio: 'Software developer with 5+ years experience',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  }
})

// Query with complex filters
const developers = await userRepository.findMany({
  where: {
    tags: { arrayContains: 'developer' },
    status: 'active',
    age: { gte: 25 }
  },
  orderBy: { createdAt: 'desc' },
  limit: 10
})

// Query with array operations
const taggedUsers = await userRepository.findMany({
  where: {
    tags: { arrayContainsAny: ['developer', 'designer', 'manager'] }
  }
})
```

### Firebase Real-time Queries

```typescript
// Listen to document changes
const unsubscribe = await userRepository.onSnapshot(
  { where: { status: 'active' } },
  (snapshot) => {
    console.log('Active users updated:', snapshot.length)
    snapshot.forEach(user => {
      console.log('User:', user.id, user.firstName, user.lastName)
    })
  }
)

// Listen to specific document
const unsubscribeUser = await userRepository.onDocumentSnapshot(
  'user-id',
  (user) => {
    if (user) {
      console.log('User updated:', user.firstName, user.lastName)
    } else {
      console.log('User deleted')
    }
  }
)

// Stop listening
unsubscribe()
unsubscribeUser()
```

## MongoDB Examples

### MongoDB with TypeORM

```typescript
// repositories/MongoUserRepository.ts
import { TypeOrmConnector } from '@goatlab/fluent'
import { MongoDataSource } from '../config/database'
import { User, UserInputSchema, UserOutputSchema } from '../entities/User'

export class MongoUserRepository extends TypeOrmConnector<
  User,
  typeof UserInputSchema._type,
  typeof UserOutputSchema._type
> {
  constructor() {
    super({
      entity: User,
      dataSource: MongoDataSource,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### MongoDB Aggregation Queries

```typescript
const mongoUserRepository = new MongoUserRepository()

// Complex aggregation with nested objects
const usersByAge = await mongoUserRepository.findMany({
  where: {
    age: { gte: 18 },
    'profile.preferences.theme': 'dark'
  },
  orderBy: { age: 'desc' }
})

// Array operations
const usersWithTags = await mongoUserRepository.findMany({
  where: {
    tags: { in: ['developer', 'designer'] },
    status: 'active'
  }
})

// Text search (requires text index)
const searchResults = await mongoUserRepository.findMany({
  where: {
    $text: { $search: 'john developer' }
  }
})
```

### MongoDB Geospatial Queries

```typescript
// Entity with location
@Entity('users')
export class UserWithLocation extends User {
  @Column()
  @f.Column()
  location: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }

  @Column()
  @f.Column()
  address: {
    street: string
    city: string
    state: string
    country: string
    zipCode: string
  }
}

// Find users near a location
const nearbyUsers = await userRepository.findMany({
  where: {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [-73.9857, 40.7484] // New York coordinates
        },
        $maxDistance: 1000 // 1000 meters
      }
    }
  }
})
```

## LokiJS Examples

### LokiJS Repository Setup

```typescript
// repositories/LokiUserRepository.ts
import { LokiConnector } from '@goatlab/fluent-loki'
import LokiJS from 'lokijs'
import { User, UserInputSchema, UserOutputSchema } from '../entities/User'

// Initialize LokiJS database
const db = new LokiJS('users.db', {
  persistenceMethod: 'fs',
  autoload: true,
  autosave: true,
  autosaveInterval: 4000
})

export class LokiUserRepository extends LokiConnector<
  User,
  typeof UserInputSchema._type,
  typeof UserOutputSchema._type
> {
  constructor() {
    super({
      entity: User,
      dataSource: db,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### LokiJS Advanced Queries

```typescript
const lokiUserRepository = new LokiUserRepository()

// Complex filtering
const complexQuery = await lokiUserRepository.findMany({
  where: {
    AND: [
      { age: { gte: 25, lte: 45 } },
      { status: 'active' },
      { tags: { contains: 'javascript' } }
    ]
  }
})

// Regular expression search
const emailPattern = await lokiUserRepository.findMany({
  where: {
    email: { regex: /^[a-zA-Z0-9._%+-]+@company\.com$/ }
  }
})

// Array size filtering
const usersWithManyTags = await lokiUserRepository.findMany({
  where: {
    tags: { size: { gte: 3 } }
  }
})
```

### LokiJS Views and Transforms

```typescript
// Access underlying LokiJS collection
const collection = lokiUserRepository.getCollection()

// Create dynamic view
const activeUsersView = collection.addDynamicView('activeUsers')
activeUsersView.applyFind({ status: 'active' })
activeUsersView.applySimpleSort('createdAt', true)

// Create transform for data manipulation
const userSummaryTransform = collection.addTransform('userSummary', [
  {
    type: 'find',
    value: { status: 'active' }
  },
  {
    type: 'simplesort',
    property: 'lastName',
    desc: false
  },
  {
    type: 'mapReduce',
    mapFunction: (user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      tagCount: user.tags.length
    })
  }
])

// Get transformed data
const userSummaries = userSummaryTransform.data()
```

## PouchDB Examples

### PouchDB Repository Setup

```typescript
// repositories/PouchUserRepository.ts
import { PouchDBConnector } from '@goatlab/fluent-pouchdb'
import PouchDB from 'pouchdb'
import { User, UserInputSchema, UserOutputSchema } from '../entities/User'

// Initialize PouchDB
const db = new PouchDB('users-db')

export class PouchUserRepository extends PouchDBConnector<
  User,
  typeof UserInputSchema._type,
  typeof UserOutputSchema._type
> {
  constructor() {
    super({
      entity: User,
      dataSource: db,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### PouchDB Queries with Mango

```typescript
const pouchUserRepository = new PouchUserRepository()

// Create indexes for better query performance
await db.createIndex({
  index: {
    fields: ['status', 'age', 'createdAt']
  }
})

// Complex queries using Mango syntax
const youngActiveUsers = await pouchUserRepository.findMany({
  where: {
    status: 'active',
    age: { gte: 18, lte: 30 }
  },
  orderBy: { createdAt: 'desc' },
  limit: 50
})

// Array operations
const taggedUsers = await pouchUserRepository.findMany({
  where: {
    tags: { elemMatch: { $in: ['developer', 'designer'] } }
  }
})
```

### PouchDB Synchronization

```typescript
// Sync with remote CouchDB
const remoteDb = new PouchDB('http://localhost:5984/users')

// One-way sync (local to remote)
const replicationToRemote = db.replicate.to(remoteDb, {
  live: true,
  retry: true
})

// One-way sync (remote to local)
const replicationFromRemote = db.replicate.from(remoteDb, {
  live: true,
  retry: true
})

// Bidirectional sync
const sync = db.sync(remoteDb, {
  live: true,
  retry: true
})

// Handle sync events
sync.on('change', (change) => {
  console.log('Sync change:', change.direction, change.change.docs.length)
})

sync.on('error', (err) => {
  console.error('Sync error:', err)
})
```

## Cross-Platform Query Patterns

### Unified Query Interface

```typescript
// Abstract repository that works with any connector
abstract class BaseUserRepository {
  protected abstract repository: any

  async findActiveUsers(limit: number = 10) {
    return await this.repository.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      limit
    })
  }

  async findUsersByAge(minAge: number, maxAge: number) {
    return await this.repository.findMany({
      where: {
        age: { gte: minAge, lte: maxAge }
      }
    })
  }

  async searchUsers(searchTerm: string) {
    return await this.repository.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm } },
          { lastName: { contains: searchTerm } },
          { email: { contains: searchTerm } }
        ]
      }
    })
  }
}

// Firebase implementation
class FirebaseUserService extends BaseUserRepository {
  protected repository = new FirebaseUserRepository()
}

// MongoDB implementation
class MongoUserService extends BaseUserRepository {
  protected repository = new MongoUserRepository()
}

// LokiJS implementation
class LokiUserService extends BaseUserRepository {
  protected repository = new LokiUserRepository()
}
```

### Database-Specific Optimizations

```typescript
// Firebase-specific optimizations
class OptimizedFirebaseUserRepository extends FirebaseUserRepository {
  async findUsersByTags(tags: string[]) {
    // Use Firebase's arrayContainsAny for better performance
    return await this.findMany({
      where: {
        tags: { arrayContainsAny: tags }
      }
    })
  }

  async findNearbyUsers(latitude: number, longitude: number, radiusKm: number) {
    // Use Firebase's geoqueries
    return await this.findMany({
      where: {
        location: {
          geopoint: {
            latitude,
            longitude,
            radius: radiusKm
          }
        }
      }
    })
  }
}

// MongoDB-specific optimizations
class OptimizedMongoUserRepository extends MongoUserRepository {
  async aggregateUsersByAge() {
    // Use MongoDB aggregation pipeline
    return await this.query([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: '$age',
          count: { $sum: 1 },
          avgAge: { $avg: '$age' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ])
  }

  async fullTextSearch(searchTerm: string) {
    // Use MongoDB text search
    return await this.findMany({
      where: {
        $text: { $search: searchTerm }
      }
    })
  }
}
```

## Performance Optimization for NoSQL

### Efficient Data Modeling

```typescript
// Denormalized data model for NoSQL
@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  @f.Column()
  id: string

  // Embedded user data
  @Column()
  @f.Column()
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  }

  // Embedded posts for quick access
  @Column()
  @f.Column()
  recentPosts: Array<{
    id: string
    title: string
    excerpt: string
    createdAt: Date
  }>

  // Embedded statistics
  @Column()
  @f.Column()
  stats: {
    totalPosts: number
    totalLikes: number
    totalComments: number
    lastActiveAt: Date
  }
}
```

### Batch Operations

```typescript
// Efficient batch operations
class BatchUserOperations {
  private repository: any

  constructor(repository: any) {
    this.repository = repository
  }

  async batchUpdateUserStatus(userIds: string[], status: string) {
    // Process in batches to avoid memory issues
    const batchSize = 100
    const results = []

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize)
      
      const updates = batch.map(id => ({
        id,
        data: { status, updatedAt: new Date() }
      }))
      
      const batchResults = await Promise.all(
        updates.map(update => 
          this.repository.updateById(update.id, update.data)
        )
      )
      
      results.push(...batchResults)
    }

    return results
  }
}
```

### Caching Strategies

```typescript
// Cache layer for NoSQL queries
class CachedUserRepository {
  private repository: any
  private cache: Map<string, any> = new Map()
  private cacheExpiry: Map<string, number> = new Map()

  constructor(repository: any) {
    this.repository = repository
  }

  async findById(id: string, ttl: number = 300000): Promise<any> {
    const cacheKey = `user:${id}`
    const cached = this.cache.get(cacheKey)
    const expiry = this.cacheExpiry.get(cacheKey)

    if (cached && expiry && Date.now() < expiry) {
      return cached
    }

    const user = await this.repository.findById(id)
    
    if (user) {
      this.cache.set(cacheKey, user)
      this.cacheExpiry.set(cacheKey, Date.now() + ttl)
    }

    return user
  }

  async invalidateCache(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        this.cacheExpiry.delete(key)
      }
    }
  }
}
```

This comprehensive guide covers NoSQL database operations across different connectors, showing how to leverage the unique features of each database while maintaining a consistent API through Goat Fluent.
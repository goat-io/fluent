# Firebase Connector

The Firebase connector provides seamless integration with Firebase Firestore, Google's NoSQL document database, offering real-time synchronization and offline support.

## Overview

The `FirebaseConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a unified API for Firestore operations while maintaining compatibility with the Fluent query interface.

### Features

- **Real-time Updates** - Subscribe to document changes
- **Offline Support** - Works without internet connection
- **Scalable** - Automatically scales with your application
- **Security Rules** - Fine-grained access control
- **Multi-platform** - Works across web, mobile, and server

## Installation

```bash
npm install @goatlab/fluent-firebase firebase-admin
```

## Setup

### 1. Firebase Project Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Generate a service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely

### 2. Initialize Firebase

```typescript
import { FirebaseInit } from '@goatlab/fluent-firebase'

// Initialize Firebase with service account
FirebaseInit.initializeApp({
  credential: FirebaseInit.credential.cert({
    projectId: 'your-project-id',
    clientEmail: 'your-service-account@your-project.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
  })
})

// Or initialize with service account file
FirebaseInit.initializeApp({
  credential: FirebaseInit.credential.cert('./path/to/service-account.json')
})
```

### 3. Define Your Entity

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users') // This will be the Firestore collection name
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
  age: z.number().min(0).max(150).optional()
})

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
})
```

### 4. Create Repository

```typescript
import { FirebaseConnector } from '@goatlab/fluent-firebase'
import { User, UserInputSchema, UserOutputSchema } from './entities/User'

export class UserRepository extends FirebaseConnector<User, typeof UserInputSchema._type, typeof UserOutputSchema._type> {
  constructor() {
    super({
      entity: User,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }
}
```

### 5. Initialize and Use

```typescript
import { Fluent } from '@goatlab/fluent'
import { modelGeneratorDataSource } from '@goatlab/fluent'
import { User } from './entities/User'

// Initialize Fluent with your entities
await Fluent.initialize([modelGeneratorDataSource], [User])

// Create repository instance
const userRepository = new UserRepository()

// Use the repository
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30
})
```

## CRUD Operations

### Create

```typescript
// Insert single document
const user = await userRepository.insert({
  email: 'john@example.com',
  name: 'John Doe',
  age: 30
})

// Insert multiple documents
const users = await userRepository.insertMany([
  { email: 'john@example.com', name: 'John Doe', age: 30 },
  { email: 'jane@example.com', name: 'Jane Smith', age: 25 }
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
    email: { contains: '@gmail.com' }
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
  { age: 18 }
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

## Firestore-Specific Features

### Subcollections

```typescript
@Entity('users')
@ObjectType()
export class User {
  @f.Column()
  id: string

  @f.Column()
  name: string

  // Define subcollection
  @f.Column()
  posts: Post[]
}

@Entity('posts')
@ObjectType()
export class Post {
  @f.Column()
  id: string

  @f.Column()
  title: string

  @f.Column()
  content: string

  @f.Column()
  userId: string
}

// Access subcollection
const userPosts = await userRepository.findMany({
  where: { id: 'user-id' },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' }
    }
  }
})
```

### Real-time Listeners

```typescript
// Listen to document changes
const unsubscribe = await userRepository.onSnapshot(
  { where: { age: { gte: 18 } } },
  (snapshot) => {
    console.log('Users updated:', snapshot)
  }
)

// Stop listening
unsubscribe()

// Listen to specific document
const unsubscribe = await userRepository.onDocumentSnapshot(
  'user-id',
  (user) => {
    console.log('User updated:', user)
  }
)
```

### Batch Operations

```typescript
import { Firebase } from '@goatlab/fluent-firebase'

// Create batch
const batch = Firebase.firestore().batch()

// Add operations to batch
const userRef = Firebase.firestore().collection('users').doc('user-id')
batch.set(userRef, { name: 'John', age: 30 })

const postRef = Firebase.firestore().collection('posts').doc('post-id')
batch.update(postRef, { title: 'Updated Title' })

// Commit batch
await batch.commit()
```

### Transactions

```typescript
import { Firebase } from '@goatlab/fluent-firebase'

await Firebase.firestore().runTransaction(async (transaction) => {
  const userRef = Firebase.firestore().collection('users').doc('user-id')
  const user = await transaction.get(userRef)
  
  if (!user.exists) {
    throw new Error('User does not exist')
  }
  
  const newAge = user.data().age + 1
  transaction.update(userRef, { age: newAge })
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

// In array
const users = await userRepository.findMany({
  where: { status: { in: ['active', 'pending'] } }
})

// Not in array
const users = await userRepository.findMany({
  where: { status: { notIn: ['banned', 'deleted'] } }
})
```

### Array Operators

```typescript
// Array contains
const users = await userRepository.findMany({
  where: { tags: { arrayContains: 'developer' } }
})

// Array contains any
const users = await userRepository.findMany({
  where: { tags: { arrayContainsAny: ['developer', 'designer'] } }
})
```

### Complex Queries

```typescript
// Multiple conditions (AND)
const users = await userRepository.findMany({
  where: {
    age: { gte: 18, lte: 65 },
    email: { contains: '@gmail.com' },
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
```

## Security Rules

### Basic Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow read for all authenticated users
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
  }
}
```

### Advanced Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Function to check if user owns the document
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if isOwner(userId) || isAdmin();
    }
    
    // Posts with advanced validation
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null &&
                   request.auth.uid == request.resource.data.authorId &&
                   request.resource.data.keys().hasAll(['title', 'content', 'authorId']);
      allow update: if request.auth != null &&
                   (isOwner(resource.data.authorId) || isAdmin()) &&
                   request.resource.data.keys().hasAll(['title', 'content']);
      allow delete: if isOwner(resource.data.authorId) || isAdmin();
    }
  }
}
```

## Offline Support

### Enable Offline Persistence

```typescript
import { Firebase } from '@goatlab/fluent-firebase'

// Enable offline persistence
await Firebase.firestore().enablePersistence({
  synchronizeTabs: true
})
```

### Handle Offline Data

```typescript
// Check if data is from cache
const users = await userRepository.findMany({
  where: { status: 'active' }
})

// Force server data
const users = await userRepository.findMany({
  where: { status: 'active' },
  source: 'server'
})

// Force cache data
const users = await userRepository.findMany({
  where: { status: 'active' },
  source: 'cache'
})
```

## Performance Optimization

### Indexing

```typescript
// Firestore automatically creates indexes for simple queries
// For complex queries, create composite indexes in Firebase Console

// Example: Query requiring composite index
const users = await userRepository.findMany({
  where: {
    status: 'active',
    age: { gte: 18 }
  },
  orderBy: { createdAt: 'desc' }
})
```

### Pagination

```typescript
// Cursor-based pagination
let lastDoc = null
const pageSize = 10

const getNextPage = async () => {
  const query = {
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    limit: pageSize
  }
  
  if (lastDoc) {
    query.startAfter = lastDoc
  }
  
  const users = await userRepository.findMany(query)
  
  if (users.length > 0) {
    lastDoc = users[users.length - 1]
  }
  
  return users
}
```

### Batch Reads

```typescript
// Read multiple documents by ID
const userIds = ['user1', 'user2', 'user3']
const users = await userRepository.findByIds(userIds)

// More efficient than multiple findById calls
```

## Error Handling

```typescript
import { FirebaseError } from 'firebase-admin'

try {
  const user = await userRepository.insert({
    email: 'invalid-email',
    name: ''
  })
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    console.log('Validation errors:', error.errors)
  } else if (error instanceof FirebaseError) {
    // Handle Firebase errors
    console.log('Firebase error:', error.code, error.message)
  } else {
    // Handle other errors
    console.log('Unknown error:', error.message)
  }
}
```

## Environment Configuration

```typescript
// config/firebase.ts
export const firebaseConfig = {
  development: {
    projectId: 'your-dev-project',
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_DEV
  },
  production: {
    projectId: 'your-prod-project',
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_PROD
  }
}

// Initialize based on environment
const config = firebaseConfig[process.env.NODE_ENV || 'development']
FirebaseInit.initializeApp({
  credential: FirebaseInit.credential.cert(JSON.parse(config.credential))
})
```

## Best Practices

1. **Use proper indexing** for complex queries
2. **Implement security rules** to protect your data
3. **Handle offline scenarios** gracefully
4. **Use batch operations** for multiple writes
5. **Implement proper error handling** with try-catch blocks
6. **Use transactions** for atomic operations
7. **Optimize queries** to reduce read costs
8. **Use subcollections** for hierarchical data
9. **Monitor usage** in Firebase Console
10. **Implement proper pagination** for large datasets

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check your security rules
2. **Index Missing**: Create composite indexes in Firebase Console
3. **Offline Persistence**: Enable persistence for offline support
4. **Rate Limiting**: Implement proper retry logic
5. **Large Documents**: Split large documents into smaller ones

### Debug Mode

```typescript
// Enable debug logging
import { setLogLevel } from 'firebase-admin'
setLogLevel('debug')

// Monitor performance
const users = await userRepository.findMany({
  where: { status: 'active' }
})
console.log('Query execution time:', performance.now() - startTime)
```

This comprehensive guide covers all aspects of using the Firebase connector with Goat Fluent.
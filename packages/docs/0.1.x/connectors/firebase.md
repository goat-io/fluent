# Firebase Connector

The Firebase connector provides seamless integration with Firebase Firestore, Google's NoSQL document database, enabling type-safe queries with Zod schema validation.

## Overview

The `FirebaseConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a unified API for Firestore operations while maintaining compatibility with the Fluent query interface.

### Key Features

- **Type-safe queries** - Full TypeScript support with Zod schema validation
- **Batch operations** - Efficient bulk inserts and updates
- **Complex queries** - Support for AND/OR conditions and multiple operators
- **Relations support** - Load related data with ease
- **Emulator support** - Local development and testing
- **Raw access** - Direct access to Firebase Admin SDK when needed

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

// Initialize Firebase with service account file
FirebaseInit({
  databaseName: 'your-project-id',
  serviceAccount: './path/to/service-account.json'
})

// Initialize with emulator for local development
FirebaseInit({
  databaseName: 'test-project',
  emulator: true,
  host: 'localhost',
  port: 8080
})

// Initialize with application default credentials
FirebaseInit({
  databaseName: 'your-project-id'
  // serviceAccount is optional - will use application default credentials
})
```

### 3. Define Your Entity

```typescript
import { Entity, Column } from 'typeorm'
import { ObjectType, f } from '@goatlab/fluent'
import { z } from 'zod'

@Entity('users') // This will be the Firestore collection name
@ObjectType()
export class User {
  @Column()
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
  created?: Date

  @Column()
  @f.Column()
  updated?: Date
}

// Define your schemas
export const UserInputSchema = z.object({
  id: z.string().optional(), // ID is auto-generated if not provided
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().min(0).max(150).optional(),
  created: z.date().optional(),
  updated: z.date().optional()
})

export const UserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  age: z.number().optional(),
  created: z.date().optional(),
  updated: z.date().optional()
})
```

### 4. Create Repository

```typescript
import { FirebaseConnector } from '@goatlab/fluent-firebase'
import { User, UserInputSchema, UserOutputSchema } from './entities/User'

export class UserRepository extends FirebaseConnector<User> {
  constructor() {
    super({
      entity: User,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema // optional, defaults to inputSchema
    })
  }
}
```

### 5. Initialize and Use

```typescript
import { Fluent } from '@goatlab/fluent'
import { User } from './entities/User'
import { UserRepository } from './repositories/UserRepository'

// Initialize Fluent with your entities
// For Firebase, pass empty array for datasources as it doesn't use TypeORM datasources
await Fluent.initialize([], [User])

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
    age: { gte: 18 }
  },
  orderBy: [{ created: 'desc' }],
  limit: 10
})

// Find by ID
const user = await userRepository.findById('user-id')

// Find first matching document
const user = await userRepository.findFirst({
  where: { email: 'john@example.com' }
})

// Find with complex conditions
const users = await userRepository.findMany({
  where: {
    AND: [
      { age: { gte: 18 } },
      { age: { lte: 65 } }
    ],
    OR: [
      { email: { endsWith: '@gmail.com' } },
      { email: { endsWith: '@company.com' } }
    ]
  }
})
```

### Update

```typescript
// Update by ID (PATCH - partial update)
const updatedUser = await userRepository.updateById('user-id', {
  name: 'John Updated',
  age: 31
})

// Replace by ID (PUT - full replacement)
const replacedUser = await userRepository.replaceById('user-id', {
  email: 'john@example.com',
  name: 'John Replaced',
  age: 31
})

// Note: updateMany is not implemented in FirebaseConnector
// Use batch operations for multiple updates
```

### Delete

```typescript
// Delete by ID
const deletedId = await userRepository.deleteById('user-id')

// Clear all documents in collection (use with caution!)
await userRepository.clear()

// Note: deleteMany is not implemented in FirebaseConnector
// Use batch operations for multiple deletes
```

## Firestore-Specific Features

### Raw Access to Firebase Admin SDK

```typescript
// Access the raw Firestore collection
const collection = userRepository.raw()

// Use native Firebase queries
const snapshot = await collection
  .where('age', '>=', 18)
  .orderBy('age')
  .limit(10)
  .get()

snapshot.forEach(doc => {
  console.log(doc.id, '=>', doc.data())
})

// Access raw Firestore instance
const firestore = userRepository.rawFirebase()

// Use for advanced operations
const batch = firestore.batch()
```

### Relations Support

```typescript
// Define relationships in your repository
export class UserRepository extends FirebaseConnector<User> {
  constructor() {
    super({
      entity: User,
      inputSchema: UserInputSchema
    })
  }

  // Has many relationship
  public cars = () => {
    return this.hasMany({
      repository: CarRepository,
      model: CarEntity
    })
  }

  // Belongs to many relationship (many-to-many)
  public roles = () => {
    return this.belongsToMany({
      repository: RoleRepository,
      pivot: RoleUserRepository
    })
  }
}

// Load related data
const users = await userRepository.findMany({
  include: {
    cars: true,
    roles: {
      include: {
        permissions: true
      }
    }
  }
})

// Load first with relations
const user = await userRepository.loadFirst({
  where: { email: 'john@example.com' }
})

// Load by ID with relations
const user = await userRepository.loadById('user-id')
```

### Batch Operations

```typescript
// Batch insert multiple documents
const users = await userRepository.insertMany([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  { email: 'user3@example.com', name: 'User 3' }
])

// For more complex batch operations, use raw access
const firestore = userRepository.rawFirebase()
const batch = firestore.batch()

// Add operations to batch
const collection = userRepository.raw()
batch.set(collection.doc('user-1'), { name: 'John', age: 30 })
batch.update(collection.doc('user-2'), { age: 31 })
batch.delete(collection.doc('user-3'))

// Commit batch
await batch.commit()
```

### Transactions

```typescript
const firestore = userRepository.rawFirebase()

await firestore.runTransaction(async (transaction) => {
  const collection = userRepository.raw()
  const userRef = collection.doc('user-id')
  const user = await transaction.get(userRef)
  
  if (!user.exists) {
    throw new Error('User does not exist')
  }
  
  const newAge = user.data().age + 1
  transaction.update(userRef, { age: newAge })
})
```

## Query Operators

### Supported Operators

```typescript
// Equality
const users = await userRepository.findMany({
  where: { age: 30 } // equals
})

// Comparison operators
const users = await userRepository.findMany({
  where: { 
    age: { gt: 18 },        // greater than
    age: { gte: 18 },       // greater than or equal
    age: { lt: 65 },        // less than
    age: { lte: 65 },       // less than or equal
    status: { ne: 'banned' } // not equal (isNot)
  }
})

// Array operators
const users = await userRepository.findMany({
  where: { 
    status: { in: ['active', 'pending'] },         // in array
    status: { nin: ['banned', 'deleted'] },        // not in array
    tags: { arrayContains: 'developer' }           // array contains
  }
})
```

### Unsupported Operators

```typescript
// These operators will throw errors in Firebase:
// - exists
// - notExists  
// - regexp
// - like/contains (text search)

// Workaround: Use raw queries or filter in memory after fetching
```

### Complex Queries

```typescript
// Multiple conditions (implicit AND)
const users = await userRepository.findMany({
  where: {
    age: { gte: 18 },
    status: 'active'
  }
})

// Explicit AND conditions
const users = await userRepository.findMany({
  where: {
    AND: [
      { age: { gte: 18 } },
      { age: { lte: 65 } },
      { status: 'active' }
    ]
  }
})

// OR conditions (creates separate queries)
const users = await userRepository.findMany({
  where: {
    OR: [
      { age: { lt: 18 } },
      { age: { gt: 65 } }
    ]
  }
})

// Combined AND/OR
const users = await userRepository.findMany({
  where: {
    AND: [
      { status: 'active' }
    ],
    OR: [
      { role: 'admin' },
      { role: 'moderator' }
    ]
  }
})

// Note: Firebase executes OR conditions as separate queries
// and merges results, deduplicating by ID
```

## Authentication

### Using Firebase Auth Tokens

```typescript
import { Firebase } from '@goatlab/fluent-firebase'

// Verify ID token from client
try {
  const decodedToken = await Firebase.verifyIdToken(idToken)
  const uid = decodedToken.uid
  console.log('User authenticated:', uid)
} catch (error) {
  console.error('Authentication failed:', error)
}

// Get Firebase Auth instance
const auth = Firebase.getAuth()
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

## Local Development with Emulator

### Setup Firebase Emulator

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Firebase in your project
firebase init

# Start the emulator
firebase emulators:start --only firestore
```

### Connect to Emulator

```typescript
import { FirebaseInit } from '@goatlab/fluent-firebase'

// Initialize with emulator
FirebaseInit({
  databaseName: 'test-project',
  emulator: true,
  host: 'localhost',
  port: 8080 // Firestore emulator port
})

// The emulator will also set up auth emulator on port 9099
```

## Performance Optimization

### Query Optimization

```typescript
// Firestore automatically creates indexes for simple queries
// For complex queries, create composite indexes in Firebase Console

// Example: Query requiring composite index
const users = await userRepository.findMany({
  where: {
    status: 'active',
    age: { gte: 18 }
  },
  orderBy: [{ created: 'desc' }]
})

// Use limit and offset for pagination
const users = await userRepository.findMany({
  where: { status: 'active' },
  orderBy: [{ created: 'desc' }],
  limit: 10,
  offset: 20
})
```

### Select Specific Fields

```typescript
// Select only specific fields to reduce data transfer
const users = await userRepository.findMany({
  select: { id: true, name: true, email: true },
  where: { status: 'active' }
})
```

### Batch Reads

```typescript
// Read multiple documents by ID using 'in' operator
const userIds = ['user1', 'user2', 'user3']
const users = await userRepository.findMany({
  where: { id: { in: userIds } }
})

// More efficient than multiple findById calls
```

## Error Handling

```typescript
import { z } from 'zod'

try {
  const user = await userRepository.insert({
    email: 'invalid-email',
    name: ''
  })
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    console.log('Validation errors:', error.errors)
  } else if (error.code) {
    // Handle Firebase errors
    console.log('Firebase error:', error.code, error.message)
    
    switch (error.code) {
      case 'permission-denied':
        console.log('Check your security rules')
        break
      case 'not-found':
        console.log('Document not found')
        break
      case 'already-exists':
        console.log('Document already exists')
        break
      default:
        console.log('Other Firebase error')
    }
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

1. **Define proper Zod schemas** for type safety and validation
2. **Use proper indexing** for complex queries in Firebase Console
3. **Implement security rules** to protect your data
4. **Use batch operations** (`insertMany`) for multiple writes
5. **Implement proper error handling** with try-catch blocks
6. **Use transactions** for atomic operations with raw access
7. **Optimize queries** with `select` to reduce data transfer
8. **Use `limit` and `offset`** for pagination
9. **Monitor usage** in Firebase Console to track read/write costs
10. **Use emulator** for local development and testing
11. **Handle validation errors** from Zod schemas gracefully
12. **Use explicit entity definitions** with `@f.Column()` decorators

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check your security rules and authentication
2. **Index Missing**: Create composite indexes in Firebase Console for complex queries
3. **Validation Errors**: Check your Zod schemas match your data structure
4. **Emulator Connection**: Ensure emulator is running on correct port
5. **Service Account**: Verify service account file path and permissions
6. **Entity Registration**: Ensure entities are registered with `@Entity()` and `@ObjectType()`

### Debug Mode

```typescript
// Enable debug logging for Firebase Admin
process.env.FIRESTORE_DEBUG = 'true'
process.env.GOOGLE_CLOUD_PROJECT_DEBUG = 'true'

// Monitor query execution
const startTime = performance.now()
const users = await userRepository.findMany({
  where: { status: 'active' }
})
const endTime = performance.now()
console.log(`Query execution time: ${endTime - startTime}ms`)

// Test emulator connection
const firestore = userRepository.rawFirebase()
const settings = firestore._settings
console.log('Firestore settings:', settings)
```

### Testing Connection

```typescript
// Test basic connectivity
try {
  const testDoc = await userRepository.raw().doc('test').get()
  console.log('Firebase connection successful')
} catch (error) {
  console.error('Firebase connection failed:', error)
}
```

## Missing Functionality & Limitations

The current Firebase connector implementation has several limitations compared to other Fluent connectors:

### Not Implemented

1. **Real-time Listeners**: No `onSnapshot` or `onDocumentSnapshot` methods
2. **Advanced Pagination**: No cursor-based pagination with `startAfter`/`startAt`
3. **updateMany/deleteMany**: Only single document updates/deletes supported
4. **Geographic Queries**: No geospatial query support
5. **Full-text Search**: No text search capabilities
6. **Aggregations**: No count, sum, avg operations
7. **Array-contains-any**: Limited array query operators
8. **Compound array queries**: Cannot combine `array-contains` with other operators

### Workarounds

```typescript
// Real-time updates - use raw access
const collection = userRepository.raw()
const unsubscribe = collection.onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    console.log('Document changed:', change.type, change.doc.data())
  })
})

// Bulk operations - use raw batch
const firestore = userRepository.rawFirebase()
const batch = firestore.batch()
// Add multiple operations to batch
await batch.commit()

// Count documents - manual implementation
const snapshot = await userRepository.raw().get()
const count = snapshot.size

// Advanced pagination - use raw queries
const collection = userRepository.raw()
let lastDoc = null

const getNextPage = async () => {
  let query = collection.orderBy('created').limit(10)
  if (lastDoc) {
    query = query.startAfter(lastDoc)
  }
  const snapshot = await query.get()
  if (!snapshot.empty) {
    lastDoc = snapshot.docs[snapshot.docs.length - 1]
  }
  return snapshot.docs.map(doc => doc.data())
}
```

### Future Enhancements

These features could be added to improve the Firebase connector:

1. **Real-time subscriptions** with automatic cleanup
2. **Advanced pagination** with cursor support
3. **Bulk operations** for update/delete many
4. **Aggregation queries** for analytics
5. **Geographic queries** for location-based apps
6. **Full-text search** integration
7. **Offline persistence** configuration
8. **Array query enhancements** for better array support

### Performance Considerations

- **OR queries**: Create separate Firebase queries and merge results
- **Complex queries**: May require composite indexes
- **Large datasets**: Use pagination and field selection
- **Batch operations**: Group multiple writes for efficiency
- **Validation**: Zod schemas add validation overhead

This comprehensive guide covers all aspects of using the Firebase connector with Goat Fluent.
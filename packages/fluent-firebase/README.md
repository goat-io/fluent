# @goatlab/fluent-firebase

Firebase/Firestore connector for the Goat Fluent query interface. Provides a type-safe, schema-validated query builder for Firebase Firestore with support for complex queries, batch operations, and relations.

## Installation

```bash
npm install @goatlab/fluent-firebase
# or
yarn add @goatlab/fluent-firebase
# or
pnpm add @goatlab/fluent-firebase
```

## Basic Usage

```typescript
import { FirebaseInit, FirebaseConnector } from '@goatlab/fluent-firebase'
import { z } from 'zod'

// Initialize Firebase
FirebaseInit({
  databaseName: 'your-project-id',
  serviceAccount: './path/to/service-account.json', // optional
  emulator: false // set to true for local development
})

// Define your schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  created: z.date()
})

// Create a repository
class UserRepository extends FirebaseConnector<User> {
  constructor() {
    super({
      entity: UserEntity, // Your TypeORM-style entity class
      inputSchema: UserSchema,
      outputSchema: UserSchema // optional, defaults to inputSchema
    })
  }
}

// Use the repository
const userRepo = new UserRepository()

// Insert
const user = await userRepo.insert({
  name: 'John Doe',
  email: 'john@example.com'
})

// Query
const users = await userRepo.findMany({
  where: { email: 'john@example.com' },
  limit: 10,
  orderBy: [{ created: 'desc' }]
})

// Update
await userRepo.updateById(user.id, { name: 'Jane Doe' })

// Delete
await userRepo.deleteById(user.id)
```

## Key Features

- **Type-safe queries** with TypeScript and Zod schema validation
- **Fluent query interface** compatible with other Goat Fluent connectors
- **Complex query support** including AND/OR conditions and multiple operators
- **Batch operations** for efficient bulk inserts and updates
- **Relations support** for loading related data
- **Firebase Emulator support** for local development and testing
- **Raw access** to Firebase Admin SDK when needed
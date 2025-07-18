# Query Builder Overview

The **Fluent Query Builder** is one of the key components of the Fluent ecosystem, providing a type-safe, intuitive interface for database operations across multiple database systems. While it's a powerful standalone tool, it's designed to work seamlessly with the rest of the Fluent ecosystem.

## 🎯 What is the Query Builder?

The Query Builder is a **TypeScript-first database abstraction layer** that provides:

- **Type-safe queries** with compile-time validation
- **Fluent API** with method chaining
- **Multi-database support** through connectors
- **Relationship management** with automatic joins
- **Performance optimization** with query caching
- **Migration support** for schema evolution

## 🏗️ Architecture

The Query Builder follows a **connector pattern** that separates query construction from database execution:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fluent API    │───▶│  Query Builder  │───▶│   Connectors    │
│   (Your Code)   │    │   (Core Logic)  │    │  (DB Specific)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌────────────────────────────────┴────────────────────────────────┐
                       │                                                                  │
                       ▼                    ▼                    ▼                      ▼
                ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                │   TypeORM   │    │  Firebase   │    │   LokiJS    │    │   PouchDB   │
                │ (SQL/NoSQL) │    │ (Firestore) │    │ (In-Memory) │    │ (Offline)   │
                └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 🔧 Core Components

### 1. **Fluent Class** 
The main entry point for database operations:
```typescript
import { Fluent } from '@goat-io/fluent';

const db = new Fluent({
  connector: 'typeorm',
  connectionString: 'postgresql://localhost:5432/mydb'
});
```

### 2. **Query Builder**
Type-safe query construction:
```typescript
const users = await db.collection('users')
  .where('age', '>', 18)
  .where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(10)
  .find();
```

### 3. **Connectors**
Database-specific implementations:
- **TypeORM Connector** - MySQL, PostgreSQL, SQLite, MongoDB
- **Firebase Connector** - Firestore real-time database
- **LokiJS Connector** - In-memory database
- **PouchDB Connector** - Offline-first database
- **Form.io Connector** - Form data management

### 4. **Entity System**
Type-safe entity definitions:
```typescript
@Entity('users')
class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @HasMany(() => Post)
  posts: Post[];
}
```

## 🎨 Key Features

### **Type Safety**
Every query is validated at compile time:
```typescript
// ✅ This works - 'name' exists on User
const user = await db.collection('users').where('name', 'John').findOne();

// ❌ This fails at compile time - 'invalidField' doesn't exist
const user = await db.collection('users').where('invalidField', 'value').findOne();
```

### **Fluent API**
Chain methods for readable queries:
```typescript
const posts = await db.collection('posts')
  .where('published', true)
  .include('author')
  .include('comments.user')
  .orderBy('created_at', 'desc')
  .limit(20)
  .find();
```

### **Multi-Database Support**
Switch between databases without changing code:
```typescript
// PostgreSQL
const pgDb = new Fluent({ connector: 'typeorm', type: 'postgres' });

// MongoDB
const mongoDb = new Fluent({ connector: 'typeorm', type: 'mongodb' });

// Firebase
const fireDb = new Fluent({ connector: 'firebase' });

// Same API works across all databases
const users = await pgDb.collection('users').find();
const users = await mongoDb.collection('users').find();
const users = await fireDb.collection('users').find();
```

### **Relationship Management**
Automatic joins and eager loading:
```typescript
// Load users with their posts and comments
const users = await db.collection('users')
  .include('posts.comments')
  .find();

// Results are properly typed and nested
users.forEach(user => {
  console.log(user.name);
  user.posts.forEach(post => {
    console.log(post.title);
    post.comments.forEach(comment => {
      console.log(comment.content);
    });
  });
});
```

## 🔄 Integration with Fluent Ecosystem

The Query Builder works seamlessly with other Fluent packages:

### **With Utility Libraries**
```typescript
import { Arrays } from '@goat-io/js-utils';
import { Fluent } from '@goat-io/fluent';

const db = new Fluent('postgresql://localhost:5432/mydb');

// Use Arrays utilities with query results
const users = await db.collection('users').find();
const grouped = Arrays.groupBy(users, 'department');
const chunks = Arrays.chunk(users, 10);
```

### **With Queue Processing**
```typescript
import { Queue } from '@goat-io/queue-core';
import { Fluent } from '@goat-io/fluent';

const db = new Fluent('postgresql://localhost:5432/mydb');
const queue = new Queue('redis://localhost:6379');

// Process database operations in background
queue.process('create-user', async (job) => {
  const user = await db.collection('users').create(job.data);
  return user;
});
```

### **With File Operations**
```typescript
import { UploadService } from '@goat-io/uploads';
import { Fluent } from '@goat-io/fluent';

const db = new Fluent('postgresql://localhost:5432/mydb');
const uploads = new UploadService({ provider: 'aws' });

// Save file metadata to database
async function handleFileUpload(file: File) {
  const uploadResult = await uploads.upload(file);
  
  const fileRecord = await db.collection('files').create({
    filename: file.name,
    url: uploadResult.url,
    size: file.size,
    mimeType: file.type
  });
  
  return fileRecord;
}
```

## 🚀 Getting Started

### 1. **Installation**
```bash
npm install @goat-io/fluent
```

### 2. **Basic Setup**
```typescript
import { Fluent } from '@goat-io/fluent';

const db = new Fluent({
  connector: 'typeorm',
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'password',
  database: 'mydb'
});
```

### 3. **Define Entities**
```typescript
@Entity('users')
class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;
}
```

### 4. **Perform Operations**
```typescript
// Create
const user = await db.collection('users').create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Read
const users = await db.collection('users').find();

// Update
await db.collection('users').where('id', user.id).update({
  name: 'Jane Doe'
});

// Delete
await db.collection('users').where('id', user.id).delete();
```

## 🎯 Next Steps

1. **[Fluent Class](../core/fluent-class.md)** - Learn the main API
2. **[Query Building](../core/query-builder.md)** - Master query construction
3. **[Database Connectors](../connectors/typeorm.md)** - Explore connector options
4. **[Entity System](../core/entities.md)** - Define your data models
5. **[Examples](../examples/basic-queries.md)** - See real-world usage

The Query Builder is designed to be your primary interface for database operations, while the rest of the Fluent ecosystem provides the utilities and tools to build complete applications.
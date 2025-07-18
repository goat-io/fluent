# Database: Getting Started

Fluent's database layer provides a beautiful, expressive interface for working with your data. Whether you're building a simple API or a complex enterprise application, our query builder makes database operations intuitive and type-safe.

## The Philosophy

Fluent's database layer is built on these core principles:

<div class="content-list">

- **Type Safety**: Every query is validated at compile time
- **Expressive Syntax**: Write queries that read like natural language
- **Database Agnostic**: Works with PostgreSQL, MySQL, SQLite, MongoDB, and more
- **Relationship Focused**: Handle complex data relationships with ease
- **Performance Optimized**: Built-in query optimization and caching

</div>

## Quick Start

### Basic Setup

```typescript
import { Database } from '@fluent/database';

// Configure your database connection
const db = Database.connection('postgres://user:pass@localhost:5432/myapp');

// Start querying
const users = await db.table('users').get();
```

### Define Models

Use decorators to define your data models:

```typescript
import { Entity, Column, HasMany, PrimaryKey } from '@fluent/database';

@Entity('users')
export class User {
  @PrimaryKey()
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @HasMany(() => Post)
  posts: Post[];

  @Column('timestamp')
  created_at: Date;
}
```

## Core Features

### Simple Queries

Fluent makes basic queries beautiful and readable:

```typescript
// Get all users
const users = await User.query().get();

// Find a specific user
const user = await User.query()
  .where('email', 'john@example.com')
  .first();

// Get recent posts
const posts = await Post.query()
  .where('published', true)
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

### Advanced Filtering

Build complex queries with fluent syntax:

```typescript
// Complex conditions
const posts = await Post.query()
  .where('published', true)
  .where('created_at', '>', '2024-01-01')
  .whereIn('category', ['tech', 'design'])
  .whereNotNull('featured_image')
  .get();

// Nested conditions
const users = await User.query()
  .where('active', true)
  .where(query => {
    query.where('role', 'admin')
         .orWhere('role', 'moderator');
  })
  .get();
```

### Relationships

Handle complex data relationships effortlessly:

```typescript
// Load relationships
const user = await User.query()
  .with('posts')
  .with('posts.comments')
  .first();

// Access related data
console.log(user.posts[0].title);
console.log(user.posts[0].comments[0].content);

// Conditional loading
const posts = await Post.query()
  .with('author')
  .with('comments', query => {
    query.where('approved', true)
         .orderBy('created_at', 'desc');
  })
  .get();
```

### Aggregations

Perform calculations and data analysis:

```typescript
// Count records
const totalUsers = await User.query().count();

// Group by with aggregations
const postStats = await Post.query()
  .select('category')
  .selectRaw('COUNT(*) as total')
  .selectRaw('AVG(view_count) as avg_views')
  .groupBy('category')
  .having('total', '>', 5)
  .get();

// Complex aggregations
const userActivity = await User.query()
  .select('users.name')
  .selectRaw('COUNT(posts.id) as post_count')
  .selectRaw('COUNT(comments.id) as comment_count')
  .leftJoin('posts', 'users.id', 'posts.user_id')
  .leftJoin('comments', 'users.id', 'comments.user_id')
  .groupBy('users.id')
  .orderBy('post_count', 'desc')
  .get();
```

## Working with Data

### Creating Records

```typescript
// Create a single record
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret'
});

// Create multiple records
const users = await User.createMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);

// Create with relationships
const post = await Post.create({
  title: 'Getting Started with Fluent',
  content: 'Learn how to build amazing applications...',
  author: {
    name: 'Jane Doe',
    email: 'jane@example.com'
  }
});
```

### Updating Records

```typescript
// Update a single record
await User.query()
  .where('id', userId)
  .update({
    last_login: new Date(),
    login_count: db.raw('login_count + 1')
  });

// Update multiple records
await Post.query()
  .where('published', false)
  .where('created_at', '<', '2024-01-01')
  .update({ status: 'draft' });

// Update with model instance
const user = await User.find(userId);
user.name = 'Updated Name';
await user.save();
```

### Deleting Records

```typescript
// Delete by query
await Post.query()
  .where('published', false)
  .where('created_at', '<', '2023-01-01')
  .delete();

// Soft delete
await User.query()
  .where('id', userId)
  .softDelete();

// Delete with model instance
const user = await User.find(userId);
await user.delete();
```

## Database Connections

### Multiple Connections

```typescript
// Define multiple connections
const connections = {
  primary: Database.connection('postgres://localhost:5432/main'),
  analytics: Database.connection('postgres://localhost:5432/analytics'),
  cache: Database.connection('redis://localhost:6379')
};

// Use specific connection
const users = await connections.primary.table('users').get();
const events = await connections.analytics.table('events').get();
```

### Connection Pooling

```typescript
// Configure connection pool
const db = Database.connection('postgres://localhost:5432/myapp', {
  pool: {
    min: 2,
    max: 10,
    idle: 10000
  }
});
```

## Performance Features

### Query Caching

```typescript
// Cache query results
const posts = await Post.query()
  .where('published', true)
  .cache('published_posts', 300) // Cache for 5 minutes
  .get();

// Cache with tags
const user = await User.query()
  .where('id', userId)
  .cache(`user:${userId}`, 3600, ['users', `user:${userId}`])
  .first();
```

### Eager Loading

```typescript
// Prevent N+1 queries
const posts = await Post.query()
  .with('author')
  .with('comments.author')
  .get();

// Conditional eager loading
const posts = await Post.query()
  .with('author')
  .with('comments', query => {
    query.where('approved', true)
         .limit(5);
  })
  .get();
```

### Batch Operations

```typescript
// Batch inserts for better performance
const users = await User.batchInsert([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' },
  // ... thousands of records
], 100); // Insert in batches of 100

// Batch updates
await User.batchUpdate([
  { id: 1, name: 'Updated Name 1' },
  { id: 2, name: 'Updated Name 2' }
]);
```

## Database Agnostic

### Supported Databases

Fluent works seamlessly with multiple databases:

```typescript
// PostgreSQL
const pgDb = Database.connection('postgres://localhost:5432/myapp');

// MySQL
const mysqlDb = Database.connection('mysql://localhost:3306/myapp');

// SQLite
const sqliteDb = Database.connection('sqlite://./database.sqlite');

// MongoDB
const mongoDb = Database.connection('mongodb://localhost:27017/myapp');

// Firebase
const firebaseDb = Database.connection('firebase', {
  projectId: 'my-project',
  credentials: './firebase-admin.json'
});
```

### Cross-Database Queries

```typescript
// Same query syntax across all databases
const users = await User.query()
  .where('active', true)
  .orderBy('created_at', 'desc')
  .get();

// Works with PostgreSQL, MySQL, SQLite, MongoDB, and Firebase
```

## Real-World Examples

### E-commerce Product Catalog

```typescript
// Complex product query with filters
const products = await Product.query()
  .with('category')
  .with('images')
  .with('reviews', query => {
    query.where('approved', true)
         .orderBy('rating', 'desc');
  })
  .where('in_stock', true)
  .where('price', '>=', minPrice)
  .where('price', '<=', maxPrice)
  .whereHas('category', query => {
    query.whereIn('slug', categories);
  })
  .orderBy('popularity', 'desc')
  .paginate(page, 12);
```

### Analytics Dashboard

```typescript
// User engagement metrics
const metrics = await User.query()
  .select('users.created_at')
  .selectRaw('COUNT(*) as registrations')
  .selectRaw('COUNT(DISTINCT posts.user_id) as active_users')
  .selectRaw('AVG(posts_count.total) as avg_posts_per_user')
  .leftJoin('posts', 'users.id', 'posts.user_id')
  .leftJoin(
    db.table('posts')
      .select('user_id')
      .selectRaw('COUNT(*) as total')
      .groupBy('user_id')
      .as('posts_count'),
    'users.id', 'posts_count.user_id'
  )
  .where('users.created_at', '>=', startDate)
  .groupBy(db.raw('DATE(users.created_at)'))
  .orderBy('users.created_at')
  .get();
```

## Next Steps

Ready to dive deeper into Fluent's database features?

<div class="content-list">

### 🔍 **Query Builder**
Master advanced querying with our comprehensive [Query Builder](queries.md) guide.

### 🔗 **Relationships**
Learn about handling complex data relationships in our [Relationships](relationships.md) section.

### 📊 **Migrations**
Understand database versioning and schema changes with [Migrations](migrations.md).

### 🛠️ **Schema Builder**
Create and modify database schemas with our [Schema Builder](schema.md).

</div>

---

The database layer is where Fluent truly shines. Let's build something amazing with your data! 🚀
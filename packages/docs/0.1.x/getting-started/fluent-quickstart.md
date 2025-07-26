# Fluent Quickstart

This guide will get you up and running with @goatlab/fluent in minutes. We'll build a simple blog application to demonstrate the core concepts.

## Installation

```bash
npm install @goatlab/fluent typeorm reflect-metadata
# or
yarn add @goatlab/fluent typeorm reflect-metadata
# or  
pnpm add @goatlab/fluent typeorm reflect-metadata
```

## Your First Entity

Let's start by defining a simple blog post entity:

```typescript
import { f } from '@goatlab/fluent'
import { z } from 'zod'

// Define the entity with decorators
@f.entity('posts')
export class Post {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  title: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.property({ required: true, type: 'varchar' })
  author: string

  @f.property({ type: 'boolean' })
  published?: boolean

  @f.property({ type: 'int' })
  views?: number

  @f.created()
  createdAt?: Date

  @f.updated()
  updatedAt?: Date
}

// Define the validation schema
export const PostSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  author: z.string().min(1),
  published: z.boolean().optional().default(false),
  views: z.number().int().min(0).optional().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})
```

## Creating a Repository

Now let's create a repository to interact with our posts:

```typescript
import { TypeOrmConnector } from '@goatlab/fluent'
import { DataSource } from 'typeorm'

export class PostRepository extends TypeOrmConnector<Post> {
  constructor(dataSource: DataSource | (() => DataSource)) {
    super({
      entity: Post,
      dataSource,
      inputSchema: PostSchema
    })
  }
}
```

## Setting Up the Database

Configure your TypeORM DataSource:

```typescript
import { DataSource } from 'typeorm'

export const AppDataSource = new DataSource({
  type: 'sqlite', // or 'mysql', 'postgres', 'mongodb'
  database: ':memory:', // or your database path/name
  synchronize: true, // auto-create tables (dev only!)
  logging: false,
  entities: [Post]
})

// Initialize the connection
await AppDataSource.initialize()
```

## Basic CRUD Operations

Now you can perform all the basic operations:

```typescript
const postRepo = new PostRepository(AppDataSource)

// Create a post
const newPost = await postRepo.insert({
  title: 'Getting Started with Fluent',
  content: 'Fluent makes database operations simple and type-safe...',
  author: 'John Doe',
  published: true
})
console.log('Created post:', newPost.id)

// Find all posts
const allPosts = await postRepo.findMany()
console.log(`Found ${allPosts.length} posts`)

// Find published posts, ordered by creation date
const publishedPosts = await postRepo.findMany({
  where: { published: true },
  orderBy: { createdAt: 'desc' },
  limit: 10
})

// Find a specific post by ID
const post = await postRepo.findById(newPost.id)
console.log('Found post:', post?.title)

// Update a post
const updated = await postRepo.updateById(newPost.id, {
  views: (post?.views || 0) + 1
})

// Delete a post
await postRepo.deleteById(newPost.id)
```

## Advanced Queries

Fluent supports complex queries with MongoDB-style operators:

```typescript
// Find posts with more than 100 views
const popularPosts = await postRepo.findMany({
  where: {
    views: { $gte: 100 }
  }
})

// Find posts by specific authors
const authorPosts = await postRepo.findMany({
  where: {
    author: { $in: ['John Doe', 'Jane Smith'] }
  }
})

// Complex conditions with AND/OR
const filteredPosts = await postRepo.findMany({
  where: {
    $and: [
      { published: true },
      {
        $or: [
          { views: { $gte: 1000 } },
          { author: 'Featured Author' }
        ]
      }
    ]
  }
})

// Select specific fields only
const postTitles = await postRepo.findMany({
  select: { 
    id: true, 
    title: true, 
    author: true 
  }
})
```

## Working with Relations

Let's add comments to our blog:

```typescript
// Comment entity
@f.entity('comments')
export class Comment {
  @f.id()
  id: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.property({ required: true, type: 'varchar' })
  author: string

  @f.belongsTo({ 
    entity: () => Post, 
    inverse: 'comments',
    pivotColumnName: 'postId'
  })
  post: Post

  @f.created()
  createdAt?: Date
}

// Update Post entity to include comments
@f.entity('posts')
export class Post {
  // ... previous fields ...

  @f.hasMany({ 
    entity: () => Comment, 
    inverse: 'post' 
  })
  comments?: Comment[]
}
```

Now you can work with relations:

```typescript
// Find post with all its comments
const postWithComments = await postRepo.findById(postId, {
  include: { comments: true }
})

console.log(`Post has ${postWithComments?.comments?.length} comments`)

// Find posts with comment count
const postsWithCommentCount = await postRepo.findMany({
  include: { 
    comments: { 
      select: { id: true } 
    } 
  }
})
```

## Error Handling

Fluent provides built-in validation and error handling:

```typescript
try {
  // This will fail validation - title too short
  await postRepo.insert({
    title: '',
    content: 'Some content',
    author: 'John'
  })
} catch (error) {
  console.error('Validation failed:', error.message)
}

// Use requireById when you need the post to exist
try {
  const post = await postRepo.requireById('non-existent-id')
} catch (error) {
  console.error('Post not found!')
}
```

## Next Steps

You've learned the basics of Fluent! Here's what to explore next:

- **[Query Builder Guide](../query-builder/overview.md)** - Deep dive into query capabilities
- **[Relations Guide](../examples/relations.md)** - Master entity relationships
- **[TypeORM Connector](../connectors/typeorm.md)** - Advanced TypeORM features
- **[MongoDB Support](../examples/nosql-queries.md)** - NoSQL-specific features
- **[Performance Tips](../integration/performance-tuning.md)** - Optimize your queries

## Complete Example

Here's a complete working example you can run:

```typescript
import 'reflect-metadata'
import { f, TypeOrmConnector } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// Entity definition
@f.entity('posts')
class Post {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  title: string

  @f.property({ required: true, type: 'text' })
  content: string

  @f.property({ required: true, type: 'varchar' })
  author: string

  @f.property({ type: 'boolean' })
  published?: boolean

  @f.created()
  createdAt?: Date
}

// Schema definition
const PostSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(10),
  author: z.string(),
  published: z.boolean().optional(),
  createdAt: z.date().optional()
})

// Repository
class PostRepository extends TypeOrmConnector<Post> {
  constructor(dataSource: DataSource) {
    super({
      entity: Post,
      dataSource,
      inputSchema: PostSchema
    })
  }
}

// Main function
async function main() {
  // Setup database
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    entities: [Post]
  })

  await dataSource.initialize()

  // Create repository
  const posts = new PostRepository(dataSource)

  // Create some posts
  const post1 = await posts.insert({
    title: 'Hello Fluent',
    content: 'This is my first post using Fluent ORM',
    author: 'Developer',
    published: true
  })

  const post2 = await posts.insert({
    title: 'Advanced Queries',
    content: 'Fluent supports complex queries with ease',
    author: 'Developer',
    published: false
  })

  // Query posts
  const allPosts = await posts.findMany()
  console.log('All posts:', allPosts)

  const publishedPosts = await posts.findMany({
    where: { published: true }
  })
  console.log('Published posts:', publishedPosts)

  // Update a post
  await posts.updateById(post1.id, {
    title: 'Hello Fluent - Updated!'
  })

  // Clean up
  await dataSource.destroy()
}

main().catch(console.error)
```

Now you're ready to build amazing applications with Fluent! 🚀
# Complex Query Scenarios

This guide covers advanced query patterns and complex scenarios in the Fluent ecosystem.

## Setup

Let's define a more complex domain model for our examples:

```typescript
import { TypeOrmConnector, f } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
import { z } from 'zod'

// User entity
@f.entity('users')
class User {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  email: string

  @f.property()
  age: number

  @f.property()
  role: 'admin' | 'user' | 'moderator'

  @f.property()
  status: 'active' | 'inactive' | 'banned'

  @f.property()
  lastLoginAt: Date

  @f.property()
  createdAt: Date

  @f.property()
  profile: {
    avatar: string
    bio: string
    location: string
    preferences: {
      theme: string
      notifications: boolean
      language: string
    }
  }
}

// Post entity
@f.entity('posts')
class Post {
  @f.id()
  id: string

  @f.property()
  title: string

  @f.property()
  content: string

  @f.property()
  authorId: string

  @f.property()
  status: 'draft' | 'published' | 'archived'

  @f.property()
  tags: string[]

  @f.property()
  viewCount: number

  @f.property()
  metadata: {
    readTime: number
    featured: boolean
    category: string
  }

  @f.property()
  publishedAt: Date

  @f.property()
  createdAt: Date
}

// Comment entity
@f.entity('comments')
class Comment {
  @f.id()
  id: string

  @f.property()
  content: string

  @f.property()
  postId: string

  @f.property()
  authorId: string

  @f.property()
  parentId: string | null

  @f.property()
  approved: boolean

  @f.property()
  createdAt: Date
}
```

## Advanced Filtering

### Multi-Level Nested Conditions

```typescript
// Find users with complex nested conditions
const complexUsers = await userRepo.findMany({
  where: {
    AND: [
      { status: 'active' },
      {
        OR: [
          { role: 'admin' },
          {
            AND: [
              { age: { gte: 18 } },
              { role: 'moderator' }
            ]
          }
        ]
      },
      {
        NOT: {
          email: { endsWith: '@spam.com' }
        }
      }
    ]
  }
})
```

### Date Range Queries

```typescript
// Find users who logged in within the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

const recentlyActive = await userRepo.findMany({
  where: {
    lastLoginAt: { gte: thirtyDaysAgo }
  },
  orderBy: [{ lastLoginAt: 'desc' }]
})

// Find posts published between specific dates
const startDate = new Date('2023-01-01')
const endDate = new Date('2023-12-31')

const postsIn2023 = await postRepo.findMany({
  where: {
    publishedAt: {
      gte: startDate,
      lte: endDate
    }
  }
})
```

### Array Field Queries

```typescript
// Find posts with specific tags
const techPosts = await postRepo.findMany({
  where: {
    tags: { contains: 'technology' }
  }
})

// Find posts with any of multiple tags
const multipleTags = await postRepo.findMany({
  where: {
    OR: [
      { tags: { contains: 'javascript' } },
      { tags: { contains: 'typescript' } },
      { tags: { contains: 'react' } }
    ]
  }
})
```

### Nested Object Queries

```typescript
// Find users by nested profile properties
const darkThemeUsers = await userRepo.findMany({
  where: {
    'profile.preferences.theme': 'dark'
  }
})

// Find featured posts in specific category
const featuredTech = await postRepo.findMany({
  where: {
    AND: [
      { 'metadata.featured': true },
      { 'metadata.category': 'technology' }
    ]
  }
})
```

## Advanced Sorting

### Multi-Field Sorting with Complex Logic

```typescript
// Sort by status priority, then by role, then by creation date
const usersByPriority = await userRepo.findMany({
  orderBy: [
    { status: 'desc' }, // active > inactive > banned
    { role: 'desc' },   // admin > moderator > user
    { createdAt: 'desc' }
  ]
})
```

### Conditional Sorting

```typescript
// Sort posts by published date for published posts, by created date for drafts
const sortedPosts = await postRepo.findMany({
  orderBy: [
    { publishedAt: 'desc' },
    { createdAt: 'desc' }
  ]
})
```

## Aggregation Patterns

### Counting with Conditions

```typescript
// Count posts by status
const postCounts = {
  published: await postRepo.collect({
    where: { status: 'published' }
  }).then(posts => posts.length),
  
  draft: await postRepo.collect({
    where: { status: 'draft' }
  }).then(posts => posts.length),
  
  archived: await postRepo.collect({
    where: { status: 'archived' }
  }).then(posts => posts.length)
}
```

### Grouping Operations

```typescript
// Group users by role and count
const usersByRole = await userRepo.collect()
  .then(users => users.groupBy('role'))
  .then(grouped => {
    return Object.entries(grouped).map(([role, users]) => ({
      role,
      count: users.length,
      users: users.toArray()
    }))
  })

// Group posts by category and get stats
const postsByCategory = await postRepo.collect()
  .then(posts => posts.groupBy(post => post.metadata.category))
  .then(grouped => {
    return Object.entries(grouped).map(([category, posts]) => ({
      category,
      count: posts.length,
      totalViews: posts.reduce((sum, post) => sum + post.viewCount, 0),
      avgViews: posts.reduce((sum, post) => sum + post.viewCount, 0) / posts.length
    }))
  })
```

### Statistical Calculations

```typescript
// Calculate user statistics
const userStats = await userRepo.collect()
  .then(users => {
    const ages = users.pluck('age')
    const viewCounts = users.pluck('viewCount')
    
    return {
      totalUsers: users.length,
      averageAge: ages.reduce((a, b) => a + b, 0) / ages.length,
      medianAge: ages.sort()[Math.floor(ages.length / 2)],
      activeUsers: users.where('status', 'active').length,
      adminUsers: users.where('role', 'admin').length
    }
  })
```

## Search and Full-Text Queries

### Multi-Field Search

```typescript
// Search across multiple fields
const searchUsers = async (query: string) => {
  return await userRepo.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { email: { contains: query } },
        { 'profile.bio': { contains: query } }
      ]
    },
    orderBy: [{ name: 'asc' }]
  })
}

// Search posts with relevance scoring
const searchPosts = async (query: string) => {
  const posts = await postRepo.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } },
        { tags: { contains: query } }
      ]
    }
  })
  
  // Simple relevance scoring
  return posts.map(post => {
    let score = 0
    if (post.title.toLowerCase().includes(query.toLowerCase())) score += 3
    if (post.content.toLowerCase().includes(query.toLowerCase())) score += 1
    if (post.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) score += 2
    
    return { ...post, relevanceScore: score }
  }).sort((a, b) => b.relevanceScore - a.relevanceScore)
}
```

### Tag-Based Search

```typescript
// Find posts with all specified tags
const findPostsWithAllTags = async (tags: string[]) => {
  const conditions = tags.map(tag => ({ tags: { contains: tag } }))
  
  return await postRepo.findMany({
    where: {
      AND: conditions
    }
  })
}

// Find posts with any of specified tags
const findPostsWithAnyTags = async (tags: string[]) => {
  const conditions = tags.map(tag => ({ tags: { contains: tag } }))
  
  return await postRepo.findMany({
    where: {
      OR: conditions
    }
  })
}
```

## Performance Optimization Patterns

### Selective Field Loading

```typescript
// Load only necessary fields for list views
const postsList = await postRepo.findMany({
  select: {
    id: true,
    title: true,
    authorId: true,
    status: true,
    publishedAt: true,
    metadata: {
      category: true,
      featured: true
    }
  },
  where: { status: 'published' },
  orderBy: [{ publishedAt: 'desc' }],
  limit: 20
})
```

### Batch Operations

```typescript
// Batch update operations
const batchUpdatePosts = async (updates: Array<{id: string, data: Partial<Post>}>) => {
  const results = await Promise.all(
    updates.map(({ id, data }) => postRepo.updateById(id, data))
  )
  
  return results
}

// Batch delete operations
const batchDeletePosts = async (ids: string[]) => {
  const results = await Promise.all(
    ids.map(id => postRepo.deleteById(id))
  )
  
  return results
}
```

### Pagination with Total Count

```typescript
// Implement pagination with total count
const paginatedPosts = async (page: number, perPage: number) => {
  const offset = (page - 1) * perPage
  
  // Get data and count in parallel
  const [posts, totalCount] = await Promise.all([
    postRepo.findMany({
      where: { status: 'published' },
      orderBy: [{ publishedAt: 'desc' }],
      limit: perPage,
      offset
    }),
    postRepo.collect({ where: { status: 'published' } })
      .then(posts => posts.length)
  ])
  
  return {
    data: posts,
    meta: {
      page,
      perPage,
      total: totalCount,
      totalPages: Math.ceil(totalCount / perPage),
      hasNext: page * perPage < totalCount,
      hasPrev: page > 1
    }
  }
}
```

## Complex Business Logic

### User Activity Tracking

```typescript
// Get user activity summary
const getUserActivity = async (userId: string) => {
  const [user, posts, comments] = await Promise.all([
    userRepo.findById(userId),
    postRepo.findMany({ where: { authorId: userId } }),
    commentRepo.findMany({ where: { authorId: userId } })
  ])
  
  if (!user) return null
  
  const postsCollection = new Collection(posts)
  const commentsCollection = new Collection(comments)
  
  return {
    user,
    stats: {
      totalPosts: posts.length,
      publishedPosts: postsCollection.where('status', 'published').length,
      totalComments: comments.length,
      approvedComments: commentsCollection.where('approved', true).length,
      totalViews: postsCollection.reduce((sum, post) => sum + post.viewCount, 0),
      avgPostViews: postsCollection.length > 0 
        ? postsCollection.reduce((sum, post) => sum + post.viewCount, 0) / postsCollection.length
        : 0
    }
  }
}
```

### Content Moderation

```typescript
// Find content that needs moderation
const getContentForModeration = async () => {
  const [flaggedPosts, pendingComments] = await Promise.all([
    postRepo.findMany({
      where: {
        OR: [
          { viewCount: { gt: 10000 } }, // High traffic posts
          { 'metadata.featured': true } // Featured posts
        ]
      },
      orderBy: [{ createdAt: 'desc' }]
    }),
    commentRepo.findMany({
      where: { approved: false },
      orderBy: [{ createdAt: 'desc' }]
    })
  ])
  
  return {
    posts: flaggedPosts,
    comments: pendingComments,
    totalItems: flaggedPosts.length + pendingComments.length
  }
}
```

### Analytics Queries

```typescript
// Get platform analytics
const getPlatformAnalytics = async (days: number = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  
  const [users, posts, comments] = await Promise.all([
    userRepo.collect({ where: { createdAt: { gte: since } } }),
    postRepo.collect({ where: { createdAt: { gte: since } } }),
    commentRepo.collect({ where: { createdAt: { gte: since } } })
  ])
  
  return {
    period: `${days} days`,
    users: {
      total: users.length,
      byRole: users.groupBy('role'),
      byStatus: users.groupBy('status')
    },
    posts: {
      total: posts.length,
      byStatus: posts.groupBy('status'),
      byCategory: posts.groupBy(post => post.metadata.category),
      totalViews: posts.reduce((sum, post) => sum + post.viewCount, 0)
    },
    comments: {
      total: comments.length,
      approved: comments.where('approved', true).length,
      pending: comments.where('approved', false).length
    }
  }
}
```

## Error Handling Patterns

### Robust Query Execution

```typescript
import { Promises } from '@goatlab/js-utils'

// Robust query with fallback
const robustQuery = async <T>(
  queryFn: () => Promise<T>,
  fallback: T,
  retries: number = 3
): Promise<T> => {
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    const [error, result] = await Promises.try(queryFn)
    
    if (!error) {
      return result
    }
    
    lastError = error
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
  }
  
  console.error('Query failed after retries:', lastError)
  return fallback
}

// Usage
const users = await robustQuery(
  () => userRepo.findMany({ where: { active: true } }),
  []
)
```

### Bulk Operations with Error Handling

```typescript
// Process items in batches with error handling
const processBatch = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<Array<R | Error>> => {
  const results: Array<R | Error> = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    const batchResults = await Promise.allSettled(
      batch.map(processor)
    )
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.error(`Error processing item ${i + index}:`, result.reason)
        results.push(result.reason)
      }
    })
  }
  
  return results
}
```

## Real-World Complex Scenarios

### E-commerce Product Search

```typescript
// Complex product search with filters
const searchProducts = async (params: {
  query?: string
  category?: string
  priceRange?: { min: number, max: number }
  inStock?: boolean
  rating?: number
  sortBy?: 'price' | 'rating' | 'name' | 'newest'
  page?: number
  limit?: number
}) => {
  const conditions: any[] = []
  
  if (params.query) {
    conditions.push({
      OR: [
        { name: { contains: params.query } },
        { description: { contains: params.query } },
        { tags: { contains: params.query } }
      ]
    })
  }
  
  if (params.category) {
    conditions.push({ category: params.category })
  }
  
  if (params.priceRange) {
    conditions.push({
      price: {
        gte: params.priceRange.min,
        lte: params.priceRange.max
      }
    })
  }
  
  if (params.inStock !== undefined) {
    conditions.push({ inStock: params.inStock })
  }
  
  if (params.rating) {
    conditions.push({ averageRating: { gte: params.rating } })
  }
  
  const orderBy = getOrderBy(params.sortBy || 'newest')
  
  return await productRepo.findMany({
    where: conditions.length > 0 ? { AND: conditions } : {},
    orderBy,
    limit: params.limit || 20,
    offset: ((params.page || 1) - 1) * (params.limit || 20)
  })
}
```

### Social Media Feed Generation

```typescript
// Generate personalized feed
const generateFeed = async (userId: string, limit: number = 20) => {
  const user = await userRepo.findById(userId)
  if (!user) return []
  
  // Get user's followed users (this would come from a follows table)
  const followedUserIds = await getFollowedUsers(userId)
  
  // Get posts from followed users and own posts
  const feedPosts = await postRepo.findMany({
    where: {
      AND: [
        { status: 'published' },
        {
          OR: [
            { authorId: userId },
            { authorId: { in: followedUserIds } }
          ]
        }
      ]
    },
    orderBy: [{ publishedAt: 'desc' }],
    limit: limit * 2 // Get more to allow for filtering
  })
  
  // Apply user preferences and engagement-based filtering
  const filteredPosts = feedPosts
    .filter(post => {
      // Filter based on user preferences
      if (user.profile.preferences.contentFilters) {
        return !post.tags.some(tag => 
          user.profile.preferences.contentFilters.includes(tag)
        )
      }
      return true
    })
    .sort((a, b) => {
      // Sort by engagement score (views, comments, etc.)
      const scoreA = calculateEngagementScore(a)
      const scoreB = calculateEngagementScore(b)
      return scoreB - scoreA
    })
    .slice(0, limit)
  
  return filteredPosts
}
```

## Next Steps

- [CRUD Operations](./crud-operations.md) - Complete CRUD examples
- [Relationships](./relations.md) - Working with relationships
- [Aggregations](./aggregations.md) - Advanced aggregation queries
- [Performance Guide](../guides/performance.md) - Optimization strategies
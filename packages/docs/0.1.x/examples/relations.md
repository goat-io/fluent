# Working with Relationships

This guide covers how to work with relationships in the Fluent ecosystem, including one-to-one, one-to-many, and many-to-many relationships.

## Setup

Let's define a comprehensive blog system with relationships:

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
  createdAt: Date

  // One-to-one relationship
  @f.hasOne(() => UserProfile, 'userId')
  profile: UserProfile

  // One-to-many relationship
  @f.hasMany(() => Post, 'authorId')
  posts: Post[]

  // Many-to-many relationship
  @f.belongsToMany(() => Role, 'user_roles', 'userId', 'roleId')
  roles: Role[]
}

// UserProfile entity (one-to-one)
@f.entity('user_profiles')
class UserProfile {
  @f.id()
  id: string

  @f.property()
  userId: string

  @f.property()
  avatar: string

  @f.property()
  bio: string

  @f.property()
  website: string

  // Inverse one-to-one
  @f.belongsTo(() => User, 'userId')
  user: User
}

// Post entity (one-to-many)
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
  publishedAt: Date

  @f.property()
  createdAt: Date

  // Many-to-one relationship
  @f.belongsTo(() => User, 'authorId')
  author: User

  // One-to-many relationship
  @f.hasMany(() => Comment, 'postId')
  comments: Comment[]

  // Many-to-many relationship
  @f.belongsToMany(() => Tag, 'post_tags', 'postId', 'tagId')
  tags: Tag[]
}

// Comment entity (one-to-many)
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
  createdAt: Date

  // Many-to-one relationships
  @f.belongsTo(() => Post, 'postId')
  post: Post

  @f.belongsTo(() => User, 'authorId')
  author: User
}

// Tag entity (many-to-many)
@f.entity('tags')
class Tag {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  slug: string

  // Many-to-many relationship
  @f.belongsToMany(() => Post, 'post_tags', 'tagId', 'postId')
  posts: Post[]
}

// Role entity (many-to-many)
@f.entity('roles')
class Role {
  @f.id()
  id: string

  @f.property()
  name: string

  @f.property()
  permissions: string[]

  // Many-to-many relationship
  @f.belongsToMany(() => User, 'user_roles', 'roleId', 'userId')
  users: User[]
}

// Pivot table for user-role relationship
@f.entity('user_roles')
class UserRole {
  @f.id()
  id: string

  @f.property()
  userId: string

  @f.property()
  roleId: string

  @f.property()
  assignedAt: Date

  @f.property()
  assignedBy: string
}

// Pivot table for post-tag relationship
@f.entity('post_tags')
class PostTag {
  @f.id()
  id: string

  @f.property()
  postId: string

  @f.property()
  tagId: string

  @f.property()
  createdAt: Date
}
```

## Repository Setup

```typescript
// User repository with relationships
class UserRepository extends TypeOrmConnector<User, UserInput, UserOutput> {
  constructor(dataSource: DataSource) {
    super({
      entity: User,
      dataSource,
      inputSchema: UserInputSchema,
      outputSchema: UserOutputSchema
    })
  }

  // One-to-one relationship
  profile() {
    return this.hasOne({
      repository: UserProfileRepository,
      entity: UserProfile
    })
  }

  // One-to-many relationship
  posts() {
    return this.hasMany({
      repository: PostRepository,
      entity: Post
    })
  }

  // Many-to-many relationship
  roles() {
    return this.belongsToMany({
      repository: RoleRepository,
      entity: Role,
      pivot: UserRoleRepository
    })
  }
}

// Post repository with relationships
class PostRepository extends TypeOrmConnector<Post, PostInput, PostOutput> {
  constructor(dataSource: DataSource) {
    super({
      entity: Post,
      dataSource,
      inputSchema: PostInputSchema,
      outputSchema: PostOutputSchema
    })
  }

  // Many-to-one relationship
  author() {
    return this.belongsTo({
      repository: UserRepository,
      entity: User
    })
  }

  // One-to-many relationship
  comments() {
    return this.hasMany({
      repository: CommentRepository,
      entity: Comment
    })
  }

  // Many-to-many relationship
  tags() {
    return this.belongsToMany({
      repository: TagRepository,
      entity: Tag,
      pivot: PostTagRepository
    })
  }
}
```

## One-to-One Relationships

### Creating with One-to-One

```typescript
// Create user with profile
const createUserWithProfile = async () => {
  // Create user first
  const user = await userRepo.insert({
    name: 'John Doe',
    email: 'john@example.com'
  })

  // Create profile
  const profile = await userProfileRepo.insert({
    userId: user.id,
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Software developer and blogger',
    website: 'https://johndoe.com'
  })

  return { user, profile }
}
```

### Reading with One-to-One

```typescript
// Get user with profile using include
const getUserWithProfile = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      profile: true
    }
  })
}

// Get user with selective profile fields
const getUserWithProfileFields = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      profile: {
        select: {
          avatar: true,
          bio: true
        }
      }
    }
  })
}
```

### Updating One-to-One

```typescript
// Update user profile
const updateUserProfile = async (userId: string, profileData: Partial<UserProfile>) => {
  const user = await userRepo.findById(userId, {
    include: { profile: true }
  })

  if (!user || !user.profile) {
    throw new Error('User or profile not found')
  }

  return await userProfileRepo.updateById(user.profile.id, profileData)
}
```

## One-to-Many Relationships

### Creating with One-to-Many

```typescript
// Create user and their posts
const createUserWithPosts = async () => {
  const user = await userRepo.insert({
    name: 'Jane Author',
    email: 'jane@example.com'
  })

  // Create multiple posts for the user
  const posts = await postRepo.insertMany([
    {
      title: 'First Post',
      content: 'This is my first blog post',
      authorId: user.id,
      status: 'published',
      publishedAt: new Date()
    },
    {
      title: 'Second Post',
      content: 'This is my second blog post',
      authorId: user.id,
      status: 'draft'
    }
  ])

  return { user, posts }
}
```

### Reading with One-to-Many

```typescript
// Get user with all their posts
const getUserWithPosts = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      posts: true
    }
  })
}

// Get user with filtered posts
const getUserWithPublishedPosts = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      posts: {
        where: { status: 'published' },
        orderBy: [{ publishedAt: 'desc' }]
      }
    }
  })
}

// Get post with author and comments
const getPostWithDetails = async (postId: string) => {
  return await postRepo.findById(postId, {
    include: {
      author: {
        select: {
          name: true,
          email: true
        }
      },
      comments: {
        include: {
          author: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }]
      }
    }
  })
}
```

### Using Association Methods

```typescript
// Associate posts with a user using the relationship method
const associatePostsWithUser = async (userId: string) => {
  const user = await userRepo.loadById(userId)

  // Create posts associated with the user
  const posts = await user.posts().associate([
    {
      title: 'Associated Post 1',
      content: 'Content for associated post 1',
      status: 'published',
      publishedAt: new Date()
    },
    {
      title: 'Associated Post 2',
      content: 'Content for associated post 2',
      status: 'draft'
    }
  ])

  return posts
}

// Get posts through relationship
const getPostsThroughRelationship = async (userId: string) => {
  const user = await userRepo.loadById(userId)

  return await user.posts().findMany({
    where: { status: 'published' },
    orderBy: [{ publishedAt: 'desc' }]
  })
}
```

## Many-to-Many Relationships

### Creating with Many-to-Many

```typescript
// Create post with tags
const createPostWithTags = async () => {
  // Create tags first
  const tags = await tagRepo.insertMany([
    { name: 'JavaScript', slug: 'javascript' },
    { name: 'Web Development', slug: 'web-development' },
    { name: 'Tutorial', slug: 'tutorial' }
  ])

  // Create post
  const post = await postRepo.insert({
    title: 'JavaScript Tutorial',
    content: 'Learn JavaScript fundamentals',
    authorId: 'user-123',
    status: 'published',
    publishedAt: new Date()
  })

  // Attach tags to post
  const postWithTags = await postRepo.loadById(post.id)
  for (const tag of tags) {
    await postWithTags.tags().attach(tag.id)
  }

  return { post, tags }
}
```

### Reading with Many-to-Many

```typescript
// Get post with tags
const getPostWithTags = async (postId: string) => {
  return await postRepo.findById(postId, {
    include: {
      tags: true
    }
  })
}

// Get user with roles
const getUserWithRoles = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      roles: {
        select: {
          name: true,
          permissions: true
        }
      }
    }
  })
}

// Get posts with tags and author
const getPostsWithTagsAndAuthor = async () => {
  return await postRepo.findMany({
    where: { status: 'published' },
    include: {
      author: {
        select: {
          name: true,
          email: true
        }
      },
      tags: {
        select: {
          name: true,
          slug: true
        }
      }
    },
    orderBy: [{ publishedAt: 'desc' }]
  })
}
```

### Working with Pivot Data

```typescript
// Attach with pivot data
const attachRoleWithPivot = async (userId: string, roleId: string) => {
  const user = await userRepo.loadById(userId)

  return await user.roles().attach(roleId, {
    assignedAt: new Date(),
    assignedBy: 'admin-user-id'
  })
}

// Get relationships with pivot data
const getUserWithRolesAndPivot = async (userId: string) => {
  return await userRepo.findById(userId, {
    include: {
      roles: {
        withPivot: true
      }
    }
  })
}
```

### Detaching Relationships

```typescript
// Detach tag from post
const detachTagFromPost = async (postId: string, tagId: string) => {
  const post = await postRepo.loadById(postId)
  return await post.tags().detach(tagId)
}

// Detach all tags from post
const detachAllTagsFromPost = async (postId: string) => {
  const post = await postRepo.loadById(postId)
  return await post.tags().detachAll()
}

// Sync tags (replace all existing tags)
const syncPostTags = async (postId: string, tagIds: string[]) => {
  const post = await postRepo.loadById(postId)
  return await post.tags().sync(tagIds)
}
```

## Complex Relationship Queries

### Nested Relationships

```typescript
// Get posts with nested relationships
const getPostsWithNestedRelations = async () => {
  return await postRepo.findMany({
    include: {
      author: {
        select: {
          name: true,
          email: true
        },
        include: {
          profile: {
            select: {
              avatar: true,
              bio: true
            }
          }
        }
      },
      comments: {
        include: {
          author: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }],
        limit: 5
      },
      tags: true
    },
    where: { status: 'published' },
    orderBy: [{ publishedAt: 'desc' }]
  })
}
```

### Conditional Relationships

```typescript
// Get users with their published posts only
const getUsersWithPublishedPosts = async () => {
  return await userRepo.findMany({
    include: {
      posts: {
        where: { status: 'published' },
        select: {
          title: true,
          publishedAt: true
        },
        orderBy: [{ publishedAt: 'desc' }]
      }
    }
  })
}

// Get posts with approved comments only
const getPostsWithApprovedComments = async () => {
  return await postRepo.findMany({
    include: {
      comments: {
        where: { approved: true },
        include: {
          author: {
            select: {
              name: true
            }
          }
        }
      }
    },
    where: { status: 'published' }
  })
}
```

### Relationship Counting

```typescript
// Count relationships without loading data
const getUserPostCounts = async () => {
  const users = await userRepo.findMany({
    select: {
      id: true,
      name: true,
      email: true
    }
  })

  return await Promise.all(
    users.map(async (user) => {
      const postCount = await postRepo.collect({
        where: { authorId: user.id }
      }).then(posts => posts.length)

      return {
        ...user,
        postCount
      }
    })
  )
}

// Get post statistics
const getPostStatistics = async (postId: string) => {
  const [post, commentCount, tagCount] = await Promise.all([
    postRepo.findById(postId),
    commentRepo.collect({ where: { postId } }).then(comments => comments.length),
    postTagRepo.collect({ where: { postId } }).then(tags => tags.length)
  ])

  return {
    post,
    statistics: {
      commentCount,
      tagCount
    }
  }
}
```

## Performance Optimization

### Selective Loading

```typescript
// Load only necessary relationship data
const getPostsForListing = async () => {
  return await postRepo.findMany({
    select: {
      id: true,
      title: true,
      publishedAt: true
    },
    include: {
      author: {
        select: {
          name: true
        }
      },
      tags: {
        select: {
          name: true,
          slug: true
        }
      }
    },
    where: { status: 'published' },
    orderBy: [{ publishedAt: 'desc' }],
    limit: 20
  })
}
```

### Batch Loading

```typescript
// Load relationships in batches
const loadUsersWithPostsInBatches = async (userIds: string[]) => {
  const users = await userRepo.findByIds(userIds)
  
  // Load posts for all users in one query
  const posts = await postRepo.findMany({
    where: {
      authorId: { in: userIds }
    },
    include: {
      tags: true
    }
  })

  // Group posts by author
  const postsByAuthor = posts.reduce((acc, post) => {
    if (!acc[post.authorId]) {
      acc[post.authorId] = []
    }
    acc[post.authorId].push(post)
    return acc
  }, {} as Record<string, typeof posts>)

  // Attach posts to users
  return users.map(user => ({
    ...user,
    posts: postsByAuthor[user.id] || []
  }))
}
```

## Common Patterns

### Blog Service with Relationships

```typescript
class BlogService {
  constructor(
    private userRepo: UserRepository,
    private postRepo: PostRepository,
    private commentRepo: CommentRepository,
    private tagRepo: TagRepository
  ) {}

  // Get blog post with all related data
  async getBlogPost(postId: string) {
    return await this.postRepo.findById(postId, {
      include: {
        author: {
          select: {
            name: true,
            email: true
          },
          include: {
            profile: {
              select: {
                avatar: true,
                bio: true
              }
            }
          }
        },
        comments: {
          include: {
            author: {
              select: {
                name: true
              }
            }
          },
          orderBy: [{ createdAt: 'desc' }]
        },
        tags: true
      }
    })
  }

  // Get user's dashboard data
  async getUserDashboard(userId: string) {
    const user = await this.userRepo.findById(userId, {
      include: {
        posts: {
          select: {
            id: true,
            title: true,
            status: true,
            publishedAt: true,
            createdAt: true
          },
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const postStats = {
      total: user.posts.length,
      published: user.posts.filter(p => p.status === 'published').length,
      draft: user.posts.filter(p => p.status === 'draft').length,
      archived: user.posts.filter(p => p.status === 'archived').length
    }

    return {
      user,
      postStats
    }
  }

  // Create complete blog post
  async createBlogPost(data: {
    title: string
    content: string
    authorId: string
    tagNames: string[]
    status: 'draft' | 'published'
  }) {
    // Create or get tags
    const tags = await Promise.all(
      data.tagNames.map(async (tagName) => {
        const existingTag = await this.tagRepo.findFirst({
          where: { name: tagName }
        })

        if (existingTag) {
          return existingTag
        }

        return await this.tagRepo.insert({
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, '-')
        })
      })
    )

    // Create post
    const post = await this.postRepo.insert({
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      status: data.status,
      publishedAt: data.status === 'published' ? new Date() : null
    })

    // Attach tags
    const postWithTags = await this.postRepo.loadById(post.id)
    for (const tag of tags) {
      await postWithTags.tags().attach(tag.id)
    }

    return await this.getBlogPost(post.id)
  }
}
```

## Error Handling with Relationships

```typescript
// Safe relationship operations
const safeGetUserWithPosts = async (userId: string) => {
  try {
    const user = await userRepo.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    const userWithPosts = await userRepo.findById(userId, {
      include: {
        posts: {
          orderBy: [{ createdAt: 'desc' }]
        }
      }
    })

    return userWithPosts
  } catch (error) {
    console.error('Error getting user with posts:', error.message)
    throw error
  }
}

// Transactional relationship operations
const createPostWithTagsTransaction = async (postData: any, tagNames: string[]) => {
  // This would typically use database transactions
  // For now, we'll handle rollback manually
  
  let createdPost: Post | null = null
  const attachedTags: string[] = []

  try {
    // Create post
    createdPost = await postRepo.insert(postData)

    // Create or get tags and attach them
    const post = await postRepo.loadById(createdPost.id)
    
    for (const tagName of tagNames) {
      let tag = await tagRepo.findFirst({
        where: { name: tagName }
      })

      if (!tag) {
        tag = await tagRepo.insert({
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, '-')
        })
      }

      await post.tags().attach(tag.id)
      attachedTags.push(tag.id)
    }

    return createdPost
  } catch (error) {
    // Rollback on error
    if (createdPost) {
      await postRepo.deleteById(createdPost.id)
    }
    
    throw error
  }
}
```

## Next Steps

- [Aggregations](./aggregations.md) - Aggregation and grouping queries
- [Performance Guide](../guides/performance.md) - Optimization strategies
- [Advanced Patterns](../guides/advanced-patterns.md) - Complex relationship patterns
- [Testing Relationships](../guides/testing.md) - Testing relationship operations
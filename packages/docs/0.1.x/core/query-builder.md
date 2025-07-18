# Query Builder

Fluent provides a powerful, type-safe query builder that works across all supported databases. The query builder uses a fluent interface pattern, allowing you to chain methods to build complex queries with full TypeScript support.

## Overview

The Fluent query builder offers:
- **Type Safety**: Full TypeScript support with compile-time validation
- **Database Agnostic**: Same API works with SQL and NoSQL databases
- **Intuitive Interface**: Method chaining for readable query construction
- **Relationship Support**: Easy handling of complex data relationships
- **Performance Optimized**: Automatic query optimization and caching

## Basic Query Structure

All queries in Fluent follow the `FluentQuery<T>` interface:

```typescript
interface FluentQuery<T> {
  select?: QueryFieldSelector<T>
  where?: QueryWhereFitler<T> | LogicalOperators<T>
  orderBy?: QueryOrderSelector<T>[]
  limit?: number
  offset?: number
  include?: QueryIncludeRelation<T>
  paginated?: Paginator
}
```

## Select Queries

### Basic Selection

```typescript
// Select all fields
const users = await userRepo.findMany()

// Select specific fields
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    name: true
  }
})

// Select nested fields
const users = await userRepo.findMany({
  select: {
    id: true,
    name: true,
    posts: {
      id: true,
      title: true,
      createdAt: true
    }
  }
})
```

### Advanced Selection

```typescript
// Select with computed/transformed fields
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    fullName: true, // Computed field
    profile: {
      avatar: true,
      bio: true
    }
  }
})

// TypeScript ensures type safety
// users[0].password // ❌ TypeScript error - not selected
// users[0].email    // ✅ Available and typed
```

## Where Conditions

### Basic Conditions

```typescript
// Simple equality
const users = await userRepo.findMany({
  where: {
    isActive: true,
    age: 25
  }
})

// Using operators
const users = await userRepo.findMany({
  where: {
    age: { gte: 18 },           // Greater than or equal
    name: { like: '%John%' },    // LIKE operator
    email: { notIn: ['admin@example.com'] }
  }
})
```

### Available Operators

```typescript
// Comparison operators
const queries = {
  equals: { age: 25 },
  gt: { age: { gt: 18 } },        // Greater than
  gte: { age: { gte: 18 } },      // Greater than or equal
  lt: { age: { lt: 65 } },        // Less than
  lte: { age: { lte: 65 } },      // Less than or equal
  not: { status: { not: 'banned' } },
  
  // Array operators
  in: { status: { in: ['active', 'pending'] } },
  notIn: { role: { notIn: ['admin', 'super'] } },
  
  // String operators
  like: { name: { like: '%John%' } },
  notLike: { email: { notLike: '%spam%' } },
  startsWith: { name: { startsWith: 'John' } },
  endsWith: { email: { endsWith: '@company.com' } },
  
  // Null checks
  isNull: { deletedAt: { isNull: true } },
  isNotNull: { profileId: { isNotNull: true } }
}
```

### Logical Operators

```typescript
// AND conditions (default)
const users = await userRepo.findMany({
  where: {
    isActive: true,
    age: { gte: 18 },
    email: { like: '%@company.com' }
  }
})

// OR conditions
const users = await userRepo.findMany({
  where: {
    OR: [
      { age: { gte: 65 } },
      { role: 'admin' },
      { isVip: true }
    ]
  }
})

// Complex nested conditions
const users = await userRepo.findMany({
  where: {
    AND: [
      { isActive: true },
      {
        OR: [
          { age: { gte: 18 } },
          { hasParentalConsent: true }
        ]
      }
    ]
  }
})
```

### Relationship Conditions

```typescript
// Filter by related data
const users = await userRepo.findMany({
  where: {
    posts: {
      createdAt: { gte: new Date('2024-01-01') },
      status: 'published'
    }
  }
})

// Multiple relationship conditions
const users = await userRepo.findMany({
  where: {
    posts: {
      title: { like: '%TypeScript%' }
    },
    comments: {
      createdAt: { gte: new Date('2024-01-01') }
    }
  }
})
```

## Include (Relations)

### Basic Includes

```typescript
// Include all related data
const users = await userRepo.findMany({
  include: {
    posts: true,
    profile: true,
    roles: true
  }
})

// Include with selection
const users = await userRepo.findMany({
  include: {
    posts: {
      select: {
        id: true,
        title: true,
        createdAt: true
      }
    }
  }
})
```

### Nested Includes

```typescript
// Deep nesting
const users = await userRepo.findMany({
  include: {
    posts: {
      include: {
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    }
  }
})
```

### Conditional Includes

```typescript
// Include with where conditions
const users = await userRepo.findMany({
  include: {
    posts: {
      where: {
        status: 'published',
        createdAt: { gte: new Date('2024-01-01') }
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: 5
    }
  }
})
```

### Many-to-Many with Pivot

```typescript
// Include pivot table data
const users = await userRepo.findMany({
  include: {
    roles: {
      withPivot: true, // Include pivot table data
      select: {
        id: true,
        name: true,
        permissions: true
      }
    }
  }
})

// Access pivot data
users.forEach(user => {
  user.roles.forEach(role => {
    console.log(role.pivot) // Pivot table data
  })
})
```

## Ordering

### Basic Ordering

```typescript
// Single field ordering
const users = await userRepo.findMany({
  orderBy: [{ createdAt: 'desc' }]
})

// Multiple field ordering
const users = await userRepo.findMany({
  orderBy: [
    { age: 'desc' },
    { name: 'asc' },
    { createdAt: 'desc' }
  ]
})
```

### Nested Field Ordering

```typescript
// Order by related field
const users = await userRepo.findMany({
  orderBy: [
    { posts: { createdAt: 'desc' } },
    { profile: { score: 'desc' } }
  ]
})
```

## Pagination

### Limit and Offset

```typescript
// Basic pagination
const users = await userRepo.findMany({
  limit: 10,
  offset: 20,
  orderBy: [{ createdAt: 'desc' }]
})

// Helper method for pagination
const page = 3
const pageSize = 10
const users = await userRepo.findMany({
  limit: pageSize,
  offset: (page - 1) * pageSize,
  orderBy: [{ createdAt: 'desc' }]
})
```

### Cursor-based Pagination

```typescript
// Using cursor pagination
const users = await userRepo.findMany({
  where: {
    id: { gt: lastUserId }
  },
  limit: 10,
  orderBy: [{ id: 'asc' }]
})
```

## Aggregations

### Count Queries

```typescript
// Count all records
const totalUsers = await userRepo.count()

// Count with conditions
const activeUsers = await userRepo.count({
  where: { isActive: true }
})

// Count with relations
const usersWithPosts = await userRepo.count({
  where: {
    posts: {
      status: 'published'
    }
  }
})
```

### Using Collections for Aggregations

```typescript
// Get data as collection for advanced operations
const userCollection = await userRepo.collect({
  where: { isActive: true }
})

// Various aggregations
const stats = {
  count: userCollection.count(),
  averageAge: userCollection.avg('age'),
  maxAge: userCollection.max('age'),
  minAge: userCollection.min('age'),
  totalAge: userCollection.sum('age'),
  uniqueRoles: userCollection.pluck('role').unique()
}
```

## Complex Query Examples

### E-commerce Example

```typescript
// Find products with reviews and categories
const products = await productRepo.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    reviews: {
      id: true,
      rating: true,
      comment: true,
      author: {
        name: true
      }
    },
    categories: {
      name: true
    }
  },
  where: {
    isAvailable: true,
    price: { gte: 10, lte: 1000 },
    reviews: {
      rating: { gte: 4 }
    }
  },
  orderBy: [
    { reviews: { rating: 'desc' } },
    { price: 'asc' }
  ],
  limit: 20
})
```

### Blog Example

```typescript
// Find blog posts with authors and comments
const posts = await postRepo.findMany({
  select: {
    id: true,
    title: true,
    excerpt: true,
    content: true,
    author: {
      name: true,
      avatar: true
    },
    comments: {
      id: true,
      content: true,
      author: {
        name: true
      }
    },
    tags: {
      name: true
    }
  },
  where: {
    status: 'published',
    OR: [
      { featured: true },
      { createdAt: { gte: new Date('2024-01-01') } }
    ],
    author: {
      isActive: true
    }
  },
  orderBy: [
    { featured: 'desc' },
    { createdAt: 'desc' }
  ],
  limit: 10
})
```

### User Management Example

```typescript
// Find users with their roles and recent activity
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    lastLoginAt: true,
    roles: {
      name: true,
      permissions: true
    },
    posts: {
      id: true,
      title: true,
      createdAt: true
    }
  },
  where: {
    isActive: true,
    roles: {
      name: { in: ['admin', 'moderator'] }
    },
    lastLoginAt: { 
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    }
  },
  include: {
    posts: {
      where: {
        createdAt: { gte: new Date('2024-01-01') }
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: 5
    }
  },
  orderBy: [{ lastLoginAt: 'desc' }]
})
```

## Database-Specific Features

### SQL Databases

```typescript
// Raw SQL with parameters (MySQL/PostgreSQL)
const users = await userRepo.findMany({
  where: {
    // Custom SQL condition
    [Symbol.for('raw')]: {
      condition: 'YEAR(created_at) = ?',
      parameters: [2024]
    }
  }
})
```

### MongoDB

```typescript
// MongoDB aggregation pipeline
const users = await userRepo.findMany({
  where: {
    // MongoDB-specific operators
    tags: { $in: ['javascript', 'typescript'] },
    'profile.score': { $gte: 100 }
  }
})
```

## Query Optimization

### Eager vs Lazy Loading

```typescript
// Eager loading (includes in initial query)
const users = await userRepo.findMany({
  include: {
    posts: true,
    roles: true
  }
})

// Lazy loading (separate queries)
const users = await userRepo.findMany()
for (const user of users) {
  user.posts = await userRepo.posts().findMany({ 
    where: { authorId: user.id }
  })
}
```

### Query Caching

```typescript
import { Cache } from '@goatlab/js-utils'

class UserRepository extends TypeOrmConnector<User, CreateUserDTO, UserDTO> {
  private cache = new Cache<UserDTO[]>()

  async findActiveUsers(): Promise<UserDTO[]> {
    const cacheKey = 'active_users'
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const users = await this.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }]
    })

    this.cache.set(cacheKey, users, 5 * 60 * 1000) // 5 minutes
    return users
  }
}
```

## Type Safety Features

### Compile-time Validation

```typescript
// TypeScript catches errors at compile time
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    invalidField: true // ❌ TypeScript error
  },
  where: {
    age: { gte: 'invalid' } // ❌ TypeScript error
  }
})

// Return type is automatically inferred
// users[0].email    // ✅ string
// users[0].name     // ❌ TypeScript error - not selected
```

### Runtime Validation

```typescript
// Input validation with Zod schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().min(0).max(150)
})

// Automatic validation in repository
const user = await userRepo.insert({
  email: 'invalid-email', // ❌ Runtime error
  name: '',               // ❌ Runtime error
  age: -5                 // ❌ Runtime error
})
```

## Best Practices

### 1. Use Specific Selects

```typescript
// ❌ Avoid selecting all fields
const users = await userRepo.findMany()

// ✅ Select only needed fields
const users = await userRepo.findMany({
  select: {
    id: true,
    email: true,
    name: true
  }
})
```

### 2. Limit Result Sets

```typescript
// ❌ Avoid unbounded queries
const users = await userRepo.findMany({
  orderBy: [{ createdAt: 'desc' }]
})

// ✅ Always use limits
const users = await userRepo.findMany({
  orderBy: [{ createdAt: 'desc' }],
  limit: 100
})
```

### 3. Use Indexes for Where Conditions

```typescript
// ✅ Query fields that are indexed
const users = await userRepo.findMany({
  where: {
    email: 'user@example.com', // Indexed field
    isActive: true             // Indexed field
  }
})
```

### 4. Optimize Relationship Loading

```typescript
// ❌ N+1 query problem
const users = await userRepo.findMany()
for (const user of users) {
  user.posts = await postRepo.findMany({ 
    where: { authorId: user.id }
  })
}

// ✅ Use includes to avoid N+1
const users = await userRepo.findMany({
  include: {
    posts: true
  }
})
```

## Related Documentation

- **[TypeORM Connector](typeorm-connector.md)** - Database integration
- **[Base Connector](base-connector.md)** - Custom connector development
- **[Entities](entities.md)** - Entity definition and relationships
- **[Decorators](decorators.md)** - Entity decorators reference

## Troubleshooting

### Common Issues

1. **Type Errors**: Ensure all fields exist in entity definition
2. **Query Performance**: Use indexes and limit result sets
3. **Relationship Issues**: Check foreign key constraints
4. **Validation Errors**: Verify Zod schemas match entity types

The Fluent query builder provides a powerful, type-safe way to interact with your database while maintaining clean, readable code. Its consistent API works across all supported databases, making it easy to switch between different database systems without changing your application code.
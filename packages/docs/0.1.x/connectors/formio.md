# Form.io Connector

The Form.io connector provides a fluent query interface for Form.io, enabling seamless integration with Form.io's form and data management platform.

## Overview

The `FormioConnector` extends the `BaseConnector` class and implements the `FluentConnectorInterface`, providing a consistent API for Form.io operations. Currently, the package includes a mock in-memory implementation for testing and development, with full Form.io API integration planned.

### Current Features

- **Fluent Query Interface** - Consistent API with other Fluent connectors
- **Type-Safe Operations** - Full TypeScript support with generics
- **In-Memory Mock Storage** - Built-in testing implementation
- **Advanced Querying** - Complex filters, ordering, and pagination
- **Nested Property Support** - Query nested objects and arrays
- **Batch Operations** - Bulk insert and update capabilities

### Planned Features

- **Form.io REST API** - Full integration with Form.io platform
- **JWT Authentication** - Secure token-based authentication
- **Form Schema Management** - Dynamic form creation and updates
- **File Upload Support** - Handle form attachments
- **Webhook Integration** - Real-time event notifications
- **Role-Based Access Control** - Fine-grained permissions

## Installation

```bash
npm install @goatlab/fluent-formio
# or
yarn add @goatlab/fluent-formio
# or
pnpm add @goatlab/fluent-formio
```

## Basic Setup

### 1. Import and Initialize

```typescript
import { FormioConnector } from '@goatlab/fluent-formio'

// Define your entity type
interface User {
  id?: string
  name: string
  email: string
  age: number
  created?: string
}

// Create connector instance
const userConnector = new FormioConnector<User>({
  baseEndPoint: 'https://api.form.io/project/users',
  token: 'your-formio-token' // optional for authenticated requests
})
```

### 2. TypeScript Interface Definition

```typescript
// Define your data model
interface FormSubmission {
  id?: string
  created?: string
  modified?: string
  data: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    address?: {
      street: string
      city: string
      state: string
      zip: string
    }
  }
  metadata?: {
    formId: string
    submittedBy?: string
    status: 'draft' | 'submitted' | 'processing' | 'complete'
  }
}

// Create typed connector
const submissionConnector = new FormioConnector<FormSubmission>({
  baseEndPoint: 'https://api.form.io/project/submissions'
})
```

## Usage Examples

### Basic CRUD Operations

```typescript
// Insert a single record
const newUser = await userConnector.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
})
console.log(newUser.id) // Auto-generated ID

// Insert multiple records
const users = await userConnector.insertMany([
  { name: 'Alice', email: 'alice@example.com', age: 25 },
  { name: 'Bob', email: 'bob@example.com', age: 35 }
])

// Find by ID
const user = await userConnector.findById('user_id_123')

// Find with conditions
const adults = await userConnector.findMany({
  where: { age: { greaterOrEqualThan: 18 } }
})

// Update by ID
const updated = await userConnector.updateById('user_id_123', {
  age: 31
})

// Delete by ID
const deletedId = await userConnector.deleteById('user_id_123')
```

## Advanced Querying

### Complex Filters

```typescript
// AND conditions
const results = await userConnector.findMany({
  where: {
    AND: [
      { age: { greaterOrEqualThan: 21 } },
      { email: { contains: '@company.com' } }
    ]
  }
})

// OR conditions
const results = await userConnector.findMany({
  where: {
    OR: [
      { age: { lessThan: 18 } },
      { age: { greaterOrEqualThan: 65 } }
    ]
  }
})

// Nested object queries
const submissions = await submissionConnector.findMany({
  where: {
    'data.address.state': 'CA',
    'metadata.status': 'submitted'
  }
})

### Sorting and Pagination

```typescript
// Sort by multiple fields
const sortedUsers = await userConnector.findMany({
  orderBy: [
    { age: 'desc' },
    { name: 'asc' }
  ]
})

// Pagination with offset and limit
const page2 = await userConnector.findMany({
  offset: 10,
  limit: 10,
  orderBy: [{ created: 'desc' }]
})

// Get total count with results
const results = await userConnector.findMany({
  where: { age: { greaterOrEqualThan: 18 } },
  limit: 20
})
```

### Field Selection

```typescript
// Select specific fields
const users = await userConnector.findMany({
  select: {
    id: true,
    name: true,
    email: true
  }
})

// Select nested fields
const submissions = await submissionConnector.findMany({
  select: {
    id: true,
    'data.firstName': true,
    'data.lastName': true,
    'metadata.status': true
  }
})
```

## Utility Methods

### Find Helpers

```typescript
// Find first record matching criteria
const firstAdmin = await userConnector.findFirst({
  where: { role: 'admin' }
})

// Require record by ID (throws if not found)
const user = await userConnector.requireById('user_123')

// Require first matching record (throws if not found)
const activeUser = await userConnector.requireFirst({
  where: { status: 'active' }
})

// Pluck specific field values
const emails = await userConnector.pluck('email')
// Returns: ['john@example.com', 'jane@example.com', ...]

// Pluck nested fields
const states = await submissionConnector.pluck('data.address.state')
```

### Batch Operations

```typescript
// Load multiple records by IDs
const users = await userConnector.findByIds([
  'user_123',
  'user_456',
  'user_789'
])

// Load with field selection
const users = await userConnector.findByIds(
  ['user_123', 'user_456'],
  { select: { name: true, email: true } }
)
```

## Filter Operators

### Comparison Operators

```typescript
// Numeric comparisons
const users = await userConnector.findMany({
  where: {
    age: {
      equals: 25,
      greaterThan: 18,
      greaterOrEqualThan: 21,
      lessThan: 65,
      lessOrEqualThan: 60
    }
  }
})

// Array operators
const users = await userConnector.findMany({
  where: {
    role: { in: ['admin', 'moderator'] },
    status: { notIn: ['banned', 'suspended'] }
  }
})

// String operators (planned)
const users = await userConnector.findMany({
  where: {
    email: {
      contains: '@company.com',
      startsWith: 'admin',
      endsWith: '.com'
    }
  }
})
```

### Nested Object Filtering

```typescript
// Query nested properties
const submissions = await submissionConnector.findMany({
  where: {
    'data.address.city': 'San Francisco',
    'data.address.state': { in: ['CA', 'NY', 'TX'] },
    'metadata.status': { equals: 'submitted' }
  }
})

// Complex nested queries
const advanced = await submissionConnector.findMany({
  where: {
    AND: [
      { 'data.age': { greaterOrEqualThan: 18 } },
      {
        OR: [
          { 'data.address.country': 'USA' },
          { 'data.citizenship': 'USA' }
        ]
      }
    ]
  }
})
```

## Configuration Options

### Constructor Options

```typescript
interface IFormioConnector {
  baseEndPoint?: string  // API endpoint URL
  token?: string         // Authentication token
}

// Basic configuration
const connector = new FormioConnector({
  baseEndPoint: 'https://api.form.io/project/users'
})

// With authentication
const authenticatedConnector = new FormioConnector({
  baseEndPoint: 'https://api.form.io/project/submissions',
  token: 'jwt_token_here'
})

// Default configuration (localhost)
const defaultConnector = new FormioConnector()
// Uses: { baseEndPoint: 'http://localhost:3001' }
```

## Error Handling

```typescript
try {
  const user = await userConnector.insert({
    name: '',
    email: 'invalid-email',
    age: -5
  })
} catch (error) {
  if (error.message.includes('not found')) {
    console.log('Record not found')
  } else if (error.message.includes('Could not delete')) {
    console.log('Delete operation failed')
  } else {
    console.log('Unknown error:', error.message)
  }
}

// Handle required methods
try {
  const user = await userConnector.requireById('nonexistent_id')
} catch (error) {
  console.log('Required record not found:', error.message)
  // Error: "Object nonexistent_id not found"
}

try {
  const user = await userConnector.requireFirst({
    where: { role: 'superadmin' }
  })
} catch (error) {
  console.log('No matching record:', error.message)
  // Error: "No objects found matching: {"where":{"role":"superadmin"}}"
}
```

## Testing and Development

### Mock Storage Features

The FormioConnector includes an in-memory mock storage system perfect for testing:

```typescript
// Clear all data (useful for test cleanup)
await userConnector.clear()

// Insert test data
const testUsers = await userConnector.insertMany([
  { name: 'Alice', email: 'alice@test.com', age: 25 },
  { name: 'Bob', email: 'bob@test.com', age: 30 },
  { name: 'Charlie', email: 'charlie@test.com', age: 35 }
])

// Test queries
const adults = await userConnector.findMany({
  where: { age: { greaterOrEqualThan: 30 } }
})
expect(adults).toHaveLength(2)
```

### Test Suite Example

```typescript
import { describe, beforeEach, afterEach, test, expect } from 'vitest'
import { FormioConnector } from '@goatlab/fluent-formio'

interface TestUser {
  id?: string
  name: string
  email: string
  age: number
}

describe('FormioConnector Tests', () => {
  let connector: FormioConnector<TestUser>

  beforeEach(async () => {
    connector = new FormioConnector<TestUser>()
    await connector.clear()
  })

  afterEach(async () => {
    await connector.clear()
  })

  test('should insert and find users', async () => {
    const user = await connector.insert({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    })

    expect(user.id).toBeDefined()
    expect(user.name).toBe('John Doe')

    const found = await connector.findById(user.id!)
    expect(found?.email).toBe('john@example.com')
  })

  test('should filter by complex conditions', async () => {
    await connector.insertMany([
      { name: 'Alice', email: 'alice@company.com', age: 25 },
      { name: 'Bob', email: 'bob@company.com', age: 35 },
      { name: 'Charlie', email: 'charlie@personal.com', age: 28 }
    ])

    const companyEmployees = await connector.findMany({
      where: {
        AND: [
          { email: { contains: '@company.com' } },
          { age: { greaterOrEqualThan: 30 } }
        ]
      }
    })

    expect(companyEmployees).toHaveLength(1)
    expect(companyEmployees[0].name).toBe('Bob')
  })
})
```

## Real-World Examples

### User Management System

```typescript
interface User {
  id?: string
  username: string
  email: string
  profile: {
    firstName: string
    lastName: string
    avatar?: string
    preferences: {
      theme: 'light' | 'dark'
      notifications: boolean
    }
  }
  metadata: {
    createdAt: string
    lastLogin?: string
    isActive: boolean
    role: 'user' | 'admin' | 'moderator'
  }
}

class UserRepository extends FormioConnector<User> {
  constructor() {
    super({
      baseEndPoint: 'https://api.form.io/users'
    })
  }

  async findActiveUsers() {
    return this.findMany({
      where: { 'metadata.isActive': true }
    })
  }

  async findUsersByRole(role: string) {
    return this.findMany({
      where: { 'metadata.role': role }
    })
  }

  async searchUsers(query: string) {
    return this.findMany({
      where: {
        OR: [
          { username: { contains: query } },
          { email: { contains: query } },
          { 'profile.firstName': { contains: query } },
          { 'profile.lastName': { contains: query } }
        ]
      }
    })
  }

  async updateLastLogin(userId: string) {
    return this.updateById(userId, {
      'metadata.lastLogin': new Date().toISOString()
    } as any)
  }
}
```

### Form Submission Processing

```typescript
interface FormSubmission {
  id?: string
  formId: string
  submissionData: Record<string, any>
  workflow: {
    status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected'
    submittedAt?: string
    reviewedAt?: string
    reviewedBy?: string
    comments?: string
  }
  attachments?: Array<{
    filename: string
    url: string
    size: number
    mimeType: string
  }>
}

class SubmissionRepository extends FormioConnector<FormSubmission> {
  constructor() {
    super({
      baseEndPoint: 'https://api.form.io/submissions'
    })
  }

  async getPendingReviews() {
    return this.findMany({
      where: { 'workflow.status': 'submitted' },
      orderBy: [{ 'workflow.submittedAt': 'asc' }]
    })
  }

  async approveSubmission(id: string, reviewerId: string, comments?: string) {
    return this.updateById(id, {
      workflow: {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
        comments
      }
    } as any)
  }

  async getSubmissionsByForm(formId: string) {
    return this.findMany({
      where: { formId },
      orderBy: [{ 'workflow.submittedAt': 'desc' }]
    })
  }

  async getSubmissionStats() {
    const all = await this.findMany()
    return {
      total: all.length,
      pending: all.filter(s => s.workflow.status === 'submitted').length,
      approved: all.filter(s => s.workflow.status === 'approved').length,
      rejected: all.filter(s => s.workflow.status === 'rejected').length
    }
  }
}
```

## Performance Considerations

### Memory Usage

The in-memory mock storage is designed for testing and development:

```typescript
// Monitor storage size
const connector = new FormioConnector<User>()

// Access raw storage for debugging
const rawStorage = connector.raw()
console.log('Storage size:', rawStorage.storage.size)

// Clear storage when needed
await connector.clear()
```

### Query Optimization

```typescript
// Use specific field selection to reduce data transfer
const lightweightUsers = await userConnector.findMany({
  select: {
    id: true,
    name: true,
    email: true
  },
  limit: 100
})

// Use pagination for large datasets
const page1 = await userConnector.findMany({
  limit: 50,
  offset: 0,
  orderBy: [{ created: 'desc' }]
})

const page2 = await userConnector.findMany({
  limit: 50,
  offset: 50,
  orderBy: [{ created: 'desc' }]
})

// Prefer specific queries over broad scans
// Good: specific filter
const activeUsers = await userConnector.findMany({
  where: { status: 'active' }
})

// Avoid: scanning all records
const allUsers = await userConnector.findMany()
const filtered = allUsers.filter(u => u.status === 'active')
```

## TypeScript Support

### Full Type Safety

```typescript
// Define strongly typed interfaces
interface StrictUser {
  id?: string
  name: string
  email: string
  age: number
  preferences: {
    theme: 'light' | 'dark'
    notifications: boolean
  }
}

// TypeScript will enforce type safety
const userConnector = new FormioConnector<StrictUser>()

// This will cause TypeScript errors:
// const user = await userConnector.insert({
//   name: 123, // Error: should be string
//   email: 'invalid', // Valid
//   preferences: {
//     theme: 'blue' // Error: should be 'light' | 'dark'
//   }
// })

// Correct usage:
const user = await userConnector.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  preferences: {
    theme: 'dark',
    notifications: true
  }
})
```

### Generic Type Constraints

```typescript
// Create specialized repository classes
class TypedFormioRepository<T extends { id?: string }> extends FormioConnector<T> {
  async findActiveRecords(): Promise<T[]> {
    return this.findMany({
      where: { status: 'active' } as any
    })
  }

  async softDelete(id: string): Promise<T> {
    return this.updateById(id, {
      status: 'deleted',
      deletedAt: new Date().toISOString()
    } as any)
  }
}
```

## Best Practices

### Development

1. **Use TypeScript interfaces** for type safety
2. **Implement proper error handling** with try-catch blocks
3. **Clear mock storage** between tests
4. **Use specific field selection** to reduce data transfer
5. **Implement pagination** for large datasets
6. **Use meaningful filter conditions** for performance

### Testing

```typescript
// Good: Clean setup and teardown
describe('User Operations', () => {
  let connector: FormioConnector<User>

  beforeEach(async () => {
    connector = new FormioConnector<User>()
    await connector.clear() // Clean state
  })

  afterEach(async () => {
    await connector.clear() // Clean up
  })

  test('should handle concurrent operations', async () => {
    // Insert test data
    const users = await Promise.all([
      connector.insert({ name: 'User 1', email: 'user1@test.com', age: 25 }),
      connector.insert({ name: 'User 2', email: 'user2@test.com', age: 30 }),
      connector.insert({ name: 'User 3', email: 'user3@test.com', age: 35 })
    ])

    // Test concurrent reads
    const [user1, user2, allUsers] = await Promise.all([
      connector.findById(users[0].id!),
      connector.findById(users[1].id!),
      connector.findMany()
    ])

    expect(user1?.name).toBe('User 1')
    expect(user2?.name).toBe('User 2')
    expect(allUsers).toHaveLength(3)
  })
})
```

## Troubleshooting

### Common Issues

1. **Type Errors**: Ensure your interfaces match the data structure
2. **Not Found Errors**: Use `findById` (returns null) vs `requireById` (throws)
3. **Filter Not Working**: Check property paths for nested objects
4. **Memory Issues**: Clear storage regularly in tests
5. **ID Generation**: IDs are auto-generated with format `formio_{counter}_{timestamp}`

### Debugging

```typescript
// Debug query results
const results = await userConnector.findMany({
  where: { age: { greaterOrEqualThan: 25 } }
})
console.log('Query results:', results.length, results)

// Debug storage state
const rawStorage = userConnector.raw()
console.log('Storage contents:', Array.from(rawStorage.storage.values()))

// Test filter conditions
const testData = { age: 30, name: 'John' }
const condition = { age: { greaterOrEqualThan: 25 } }
console.log('Would match:', /* internal filter logic */)
```

## Future Roadmap

### Planned Features

The FormioConnector is actively being developed. Planned features include:

1. **Real Form.io API Integration**
   - HTTP client implementation
   - JWT authentication support
   - Form.io REST API endpoints

2. **Enhanced Query Capabilities**
   - Full-text search
   - Aggregation operations
   - Advanced date/time filtering

3. **Form.io Specific Features**
   - Form schema validation
   - File upload handling
   - Webhook support
   - Role-based access control

4. **Performance Improvements**
   - Query result caching
   - Connection pooling
   - Batch operation optimization

### Migration Path

When the real Form.io API integration is available, migration will be seamless:

```typescript
// Current mock implementation
const connector = new FormioConnector<User>({
  baseEndPoint: 'http://localhost:3001/users'
})

// Future real API implementation
const connector = new FormioConnector<User>({
  baseEndPoint: 'https://api.form.io/project/users',
  token: process.env.FORMIO_TOKEN,
  apiVersion: 'v1'
})

// Same API, same code - just configuration changes
```

## Summary

The Form.io connector provides a consistent, type-safe interface for data operations that will seamlessly integrate with Form.io's powerful form management platform. Currently featuring a robust mock implementation for development and testing, it offers:

- **Full TypeScript support** with generic type constraints
- **Fluent query interface** consistent with other Goat connectors
- **Advanced filtering** including nested object queries
- **Comprehensive testing utilities** with in-memory storage
- **Real-world ready patterns** for common use cases

Whether you're building a simple form collection system or a complex workflow management platform, the Form.io connector provides the foundation for scalable, maintainable data operations.

For more information about the Fluent ecosystem, see:
- [Base Connector Documentation](../core/base-connector.md)
- [Fluent Class Overview](../core/fluent-class.md)
- [TypeORM Connector](./typeorm.md)
- [Testing Patterns](../testing/unit-testing.md)
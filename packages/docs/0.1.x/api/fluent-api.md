# Fluent API Reference

The Fluent class provides the main entry point for the Fluent ecosystem, offering initialization methods and utility functions for working with data collections.

## Class Overview

```typescript
import { Fluent } from '@goatlab/fluent'
import { DataSource } from 'typeorm'
```

## Static Methods

### `collect<T>(data: T[]): Collection<T>`

Creates a new Collection instance from an array of data. Collections provide powerful methods for manipulating and querying data arrays.

**Parameters:**
- `data` (T[]) - Array of data to wrap in a Collection

**Returns:** Collection<T> - A new Collection instance

**Example:**
```typescript
const users = [
  { id: '1', name: 'John Doe', age: 30 },
  { id: '2', name: 'Jane Smith', age: 25 }
]

const collection = Fluent.collect(users)

// Now you can use collection methods
const names = collection.pluck('name')
const adults = collection.where('age', '>', 18)
```

### `initialize(dataSources: DataSource[], entities: any[]): Promise<void>`

Initializes the Fluent ecosystem with database connections and entity definitions. This method must be called before using any connectors or repositories.

**Parameters:**
- `dataSources` (DataSource[]) - Array of TypeORM DataSource instances
- `entities` (any[]) - Array of entity class definitions

**Returns:** Promise<void>

**Example:**
```typescript
import { DataSource } from 'typeorm'
import { User } from './entities/User'
import { Post } from './entities/Post'

const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'myapp',
  entities: [User, Post]
})

await Fluent.initialize([dataSource], [User, Post])
```

## Usage Patterns

### Basic Setup

```typescript
import { Fluent } from '@goatlab/fluent'
import { DataSource } from 'typeorm'

// Define your entities
class User {
  id: string
  name: string
  email: string
}

// Create data source
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'user',
  password: 'password',
  database: 'myapp',
  entities: [User]
})

// Initialize Fluent
await Fluent.initialize([dataSource], [User])
```

### Working with Collections

```typescript
const data = [
  { id: 1, name: 'Product A', price: 100 },
  { id: 2, name: 'Product B', price: 200 },
  { id: 3, name: 'Product C', price: 150 }
]

const products = Fluent.collect(data)

// Filter expensive products
const expensive = products.where('price', '>', 150)

// Get all names
const names = products.pluck('name')

// Group by price range
const grouped = products.groupBy(item => 
  item.price > 150 ? 'expensive' : 'affordable'
)
```

### Multiple Data Sources

```typescript
// MySQL for main data
const mysqlDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'main',
  entities: [User, Post]
})

// MongoDB for analytics
const mongoDataSource = new DataSource({
  type: 'mongodb',
  url: 'mongodb://localhost:27017/analytics',
  entities: [Analytics, Event]
})

// Initialize with both
await Fluent.initialize(
  [mysqlDataSource, mongoDataSource],
  [User, Post, Analytics, Event]
)
```

## Error Handling

The Fluent initialization process can throw errors if:
- Database connections fail
- Entity definitions are invalid
- Required dependencies are missing

```typescript
try {
  await Fluent.initialize([dataSource], [User])
  console.log('Fluent initialized successfully')
} catch (error) {
  console.error('Failed to initialize Fluent:', error.message)
}
```

## Best Practices

1. **Initialize Once**: Call `Fluent.initialize()` once at application startup
2. **Handle Errors**: Always wrap initialization in try-catch blocks
3. **Entity Registration**: Register all entities that will be used in your application
4. **Data Source Management**: Properly configure and manage your data sources

## Related Documentation

- [BaseConnector API](./connector-api.md) - Base connector functionality
- [TypeORM Integration](./connector-api.md#typeorm-connector) - TypeORM-specific features
- [Collection API](./utility-api.md#collection) - Collection manipulation methods
- [Type Definitions](./types.md) - TypeScript type definitions
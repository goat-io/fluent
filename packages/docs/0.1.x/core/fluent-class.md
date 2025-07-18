# Fluent Class

The `Fluent` class is the main entry point for the Fluent ecosystem. It provides static utility methods for database initialization, data manipulation, and collection operations.

## Overview

The Fluent class serves as the central coordinator for:
- Database initialization and connection management
- Collection utilities for data manipulation
- Static helper methods for common operations

## API Reference

### Static Methods

#### `initialize(dataSources, entities)`

Initializes the Fluent ecosystem with database connections and entity definitions.

**Parameters:**
- `dataSources: DataSource[]` - Array of TypeORM DataSource instances
- `entities: any[]` - Array of entity classes to register

**Returns:** `Promise<void>`

**Example:**
```typescript
import { DataSource } from 'typeorm'
import { Fluent } from '@goatlab/fluent'
import { User, Post, Comment } from './entities'

const AppDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'your_username',
  password: 'your_password',
  database: 'your_database',
  entities: [User, Post, Comment],
  synchronize: false,
  logging: true
})

// Initialize Fluent with database and entities
await Fluent.initialize([AppDataSource], [User, Post, Comment])
```

#### `collect(data)`

Creates a new Collection instance with the provided data for advanced manipulation.

**Parameters:**
- `data: T[]` - Array of data to wrap in a Collection

**Returns:** `Collection<T>`

**Example:**
```typescript
import { Fluent } from '@goatlab/fluent'

const users = [
  { id: '1', name: 'John', age: 30 },
  { id: '2', name: 'Jane', age: 25 },
  { id: '3', name: 'Bob', age: 35 }
]

const collection = Fluent.collect(users)

// Use collection methods
const names = collection.pluck('name')
const adults = collection.filter(user => user.age >= 18)
const sorted = collection.sortBy('age')
```

## Usage Examples

### Basic Setup

```typescript
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Fluent } from '@goatlab/fluent'
import { User } from './entities/User'

async function setupDatabase() {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: 'app.db',
    entities: [User],
    synchronize: true
  })

  await Fluent.initialize([dataSource], [User])
  console.log('Database initialized successfully')
}

setupDatabase().catch(console.error)
```

### Multiple Database Setup

```typescript
import { DataSource } from 'typeorm'
import { Fluent } from '@goatlab/fluent'
import { User, Post } from './entities'

async function setupMultipleDatabases() {
  // Primary database (MySQL)
  const primaryDB = new DataSource({
    name: 'primary',
    type: 'mysql',
    host: 'localhost',
    database: 'app_main',
    entities: [User, Post],
    synchronize: false
  })

  // Analytics database (PostgreSQL)
  const analyticsDB = new DataSource({
    name: 'analytics',
    type: 'postgres',
    host: 'localhost',
    database: 'app_analytics',
    entities: [User], // Shared entities
    synchronize: false
  })

  // Initialize both databases
  await Fluent.initialize([primaryDB, analyticsDB], [User, Post])
  console.log('Multiple databases initialized')
}
```

### Working with Collections

```typescript
import { Fluent } from '@goatlab/fluent'

// Sample data
const products = [
  { id: '1', name: 'Laptop', price: 999, category: 'Electronics' },
  { id: '2', name: 'Book', price: 29, category: 'Education' },
  { id: '3', name: 'Phone', price: 699, category: 'Electronics' },
  { id: '4', name: 'Desk', price: 199, category: 'Furniture' }
]

// Create collection
const collection = Fluent.collect(products)

// Filter by category
const electronics = collection.filter(product => 
  product.category === 'Electronics'
)

// Get product names
const productNames = collection.pluck('name')

// Group by category
const grouped = collection.groupBy('category')

// Calculate statistics
const totalValue = collection.sum('price')
const averagePrice = collection.avg('price')
const maxPrice = collection.max('price')

// Chain operations
const expensiveElectronics = collection
  .filter(product => product.category === 'Electronics')
  .filter(product => product.price > 500)
  .sortBy('price')
  .reverse()

console.log('Expensive electronics:', expensiveElectronics.toArray())
```

## Integration with Connectors

The Fluent class works seamlessly with all database connectors:

```typescript
import { Fluent, TypeOrmConnector } from '@goatlab/fluent'
import { UserRepository } from './repositories/UserRepository'

// After initialization
await Fluent.initialize([dataSource], [User])

// Create repository instances
const userRepo = new UserRepository(dataSource)

// Use repository methods
const users = await userRepo.findMany({
  where: { isActive: true },
  orderBy: [{ createdAt: 'desc' }]
})

// Convert to collection for advanced operations
const userCollection = Fluent.collect(users)
const activeUsers = userCollection.filter(user => user.isActive)
const usersByAge = userCollection.groupBy('age')
```

## Advanced Configuration

### Custom Entity Registration

```typescript
import { Fluent } from '@goatlab/fluent'
import { getMetadataArgsStorage } from 'typeorm'

// Register entities dynamically
const entityMetadatas = getMetadataArgsStorage()
const entityClasses = entityMetadatas.tables.map(table => table.target)

await Fluent.initialize([dataSource], entityClasses)
```

### Environment-Based Setup

```typescript
import { Fluent } from '@goatlab/fluent'
import { DataSource } from 'typeorm'

async function initializeForEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, Post],
    synchronize: !isProduction, // Never sync in production
    logging: !isProduction,
    ssl: isProduction ? { rejectUnauthorized: false } : false
  })

  await Fluent.initialize([dataSource], [User, Post])
  
  if (isProduction) {
    console.log('Production database initialized')
  } else {
    console.log('Development database initialized')
  }
}
```

## Error Handling

```typescript
import { Fluent } from '@goatlab/fluent'

async function robustInitialization() {
  try {
    await Fluent.initialize([dataSource], [User, Post])
    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    
    // Handle specific errors
    if (error.code === 'ECONNREFUSED') {
      console.error('Database server is not running')
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Invalid database credentials')
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Database does not exist')
    }
    
    process.exit(1)
  }
}
```

## Testing with Fluent

```typescript
import { Fluent } from '@goatlab/fluent'
import { DataSource } from 'typeorm'

describe('Fluent Integration', () => {
  let testDataSource: DataSource

  beforeAll(async () => {
    testDataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Post],
      synchronize: true
    })

    await Fluent.initialize([testDataSource], [User, Post])
  })

  afterAll(async () => {
    await testDataSource.destroy()
  })

  test('should initialize database successfully', async () => {
    expect(testDataSource.isInitialized).toBe(true)
  })

  test('should create collections', () => {
    const data = [{ id: '1', name: 'Test' }]
    const collection = Fluent.collect(data)
    
    expect(collection.count()).toBe(1)
    expect(collection.first()?.name).toBe('Test')
  })
})
```

## Best Practices

### 1. Single Initialization

Initialize Fluent once at application startup:

```typescript
// app.ts
import { initializeApp } from './config/database'

async function main() {
  await initializeApp()
  
  // Start your application
  const app = express()
  // ... rest of your app setup
}

main().catch(console.error)
```

### 2. Graceful Shutdown

Handle graceful shutdown of database connections:

```typescript
import { Fluent } from '@goatlab/fluent'

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully')
  
  // Close database connections
  const dataSources = /* get your data sources */
  await Promise.all(dataSources.map(ds => ds.destroy()))
  
  process.exit(0)
})
```

### 3. Configuration Management

Use configuration objects for complex setups:

```typescript
interface DatabaseConfig {
  type: 'mysql' | 'postgres' | 'sqlite'
  host?: string
  port?: number
  database: string
  entities: any[]
}

const config: DatabaseConfig = {
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_DATABASE,
  entities: [User, Post, Comment]
}

const dataSource = new DataSource(config)
await Fluent.initialize([dataSource], config.entities)
```

## Migration from Other ORMs

### From Prisma

```typescript
// Before (Prisma)
const prisma = new PrismaClient()
await prisma.$connect()

// After (Fluent)
await Fluent.initialize([dataSource], [User, Post])
const userRepo = new UserRepository(dataSource)
```

### From Sequelize

```typescript
// Before (Sequelize)
const sequelize = new Sequelize('database', 'username', 'password')
await sequelize.authenticate()

// After (Fluent)
await Fluent.initialize([dataSource], [User, Post])
```

## Related Documentation

- **[Installation Guide](../overview/installation.md)** - Setup instructions
- **[TypeORM Connector](typeorm-connector.md)** - Database integration
- **[Base Connector](base-connector.md)** - Custom connector development
- **[Collection Utilities](https://github.com/goat-io/fluent/tree/main/packages/js-utils)** - Advanced data manipulation

## Troubleshooting

### Common Issues

1. **Entity Not Found Errors**
   - Ensure all entities are included in the entities array
   - Check import statements for entity classes

2. **Database Connection Issues**
   - Verify database credentials and connection strings
   - Check network connectivity to database server

3. **TypeScript Errors**
   - Ensure `reflect-metadata` is imported
   - Check TypeScript configuration for decorators

### Getting Help

- Check the [GitHub Issues](https://github.com/goat-io/fluent/issues)
- Join our [Discord Community](https://discord.gg/goat)
- Review the [Architecture Guide](../overview/architecture.md)

The Fluent class provides a clean, powerful interface for managing your database layer. Its simple API combined with powerful collection utilities makes it an excellent choice for modern TypeScript applications.
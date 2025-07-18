# Connection Management Patterns

This guide covers best practices for managing database connections in Goat Fluent applications, including connection pooling, retry strategies, and multi-database patterns.

## Connection Lifecycle Management

### Single Database Connection

```typescript
// config/database.ts
import { DataSource } from 'typeorm'
import { User, Post, Comment } from '../entities'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Post, Comment],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/../migrations/*.ts']
})

// app.ts
import { AppDataSource } from './config/database'
import { Fluent } from '@goatlab/fluent'

const initializeApp = async () => {
  try {
    // Initialize the data source
    await AppDataSource.initialize()
    console.log('Database connected successfully')
    
    // Initialize Fluent
    await Fluent.initialize([AppDataSource], [User, Post, Comment])
    console.log('Fluent initialized successfully')
    
    // Start your application
    startServer()
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

const gracefulShutdown = async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log('Database connection closed')
  }
  process.exit(0)
}

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

initializeApp()
```

### Multiple Database Connections

```typescript
// config/databases.ts
import { DataSource } from 'typeorm'
import { User, Role } from '../entities/auth'
import { Product, Order } from '../entities/commerce'
import { Post, Comment } from '../entities/content'

// Authentication database
export const AuthDataSource = new DataSource({
  name: 'auth',
  type: 'postgresql',
  host: process.env.AUTH_DB_HOST,
  port: parseInt(process.env.AUTH_DB_PORT || '5432'),
  username: process.env.AUTH_DB_USER,
  password: process.env.AUTH_DB_PASSWORD,
  database: process.env.AUTH_DB_NAME,
  entities: [User, Role],
  synchronize: false,
  logging: false
})

// Commerce database
export const CommerceDataSource = new DataSource({
  name: 'commerce',
  type: 'mysql',
  host: process.env.COMMERCE_DB_HOST,
  port: parseInt(process.env.COMMERCE_DB_PORT || '3306'),
  username: process.env.COMMERCE_DB_USER,
  password: process.env.COMMERCE_DB_PASSWORD,
  database: process.env.COMMERCE_DB_NAME,
  entities: [Product, Order],
  synchronize: false,
  logging: false
})

// Content database (MongoDB)
export const ContentDataSource = new DataSource({
  name: 'content',
  type: 'mongodb',
  host: process.env.CONTENT_DB_HOST,
  port: parseInt(process.env.CONTENT_DB_PORT || '27017'),
  username: process.env.CONTENT_DB_USER,
  password: process.env.CONTENT_DB_PASSWORD,
  database: process.env.CONTENT_DB_NAME,
  entities: [Post, Comment],
  synchronize: false,
  logging: false
})

// Initialize all connections
export const initializeDatabases = async () => {
  const dataSources = [AuthDataSource, CommerceDataSource, ContentDataSource]
  const entities = [User, Role, Product, Order, Post, Comment]
  
  await Promise.all(dataSources.map(ds => ds.initialize()))
  await Fluent.initialize(dataSources, entities)
  
  console.log('All databases initialized successfully')
}
```

## Connection Pooling

### MySQL Connection Pool

```typescript
import { DataSource } from 'typeorm'

export const MySQLDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  extra: {
    // Connection pool settings
    connectionLimit: 20,        // Maximum number of connections
    acquireTimeout: 60000,      // Maximum time to wait for a connection
    timeout: 60000,             // Query timeout
    reconnect: true,            // Automatically reconnect on connection loss
    
    // Additional MySQL settings
    dateStrings: false,         // Return dates as Date objects
    debug: false,              // Enable debug mode
    trace: true,               // Enable stack traces
    
    // SSL settings for production
    ssl: process.env.NODE_ENV === 'production' ? {
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
      rejectUnauthorized: false
    } : false
  }
})
```

### PostgreSQL Connection Pool

```typescript
import { DataSource } from 'typeorm'

export const PostgreSQLDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  extra: {
    // Connection pool settings
    max: 20,                    // Maximum number of connections
    min: 2,                     // Minimum number of connections
    connectionTimeoutMillis: 60000,  // Connection timeout
    idleTimeoutMillis: 30000,        // Idle timeout
    
    // Additional PostgreSQL settings
    statement_timeout: 60000,        // Statement timeout
    query_timeout: 60000,           // Query timeout
    
    // SSL settings
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  }
})
```

### MongoDB Connection Pool

```typescript
import { DataSource } from 'typeorm'

export const MongoDataSource = new DataSource({
  type: 'mongodb',
  url: process.env.MONGODB_URI,
  entities: [__dirname + '/../entities/*.ts'],
  extra: {
    // Connection pool settings
    maxPoolSize: 20,              // Maximum number of connections
    minPoolSize: 2,               // Minimum number of connections
    maxIdleTimeMS: 30000,         // Maximum idle time
    waitQueueTimeoutMS: 60000,    // Wait queue timeout
    
    // Server selection settings
    serverSelectionTimeoutMS: 5000,  // Server selection timeout
    socketTimeoutMS: 45000,          // Socket timeout
    
    // Additional MongoDB settings
    retryWrites: true,              // Enable retry writes
    w: 'majority',                  // Write concern
    readPreference: 'primary',      // Read preference
    
    // SSL settings
    ssl: process.env.NODE_ENV === 'production',
    sslValidate: false,
    
    // Authentication
    authSource: 'admin',
    authMechanism: 'SCRAM-SHA-256'
  }
})
```

## Retry Strategies

### Connection Retry with Exponential Backoff

```typescript
// utils/connectionRetry.ts
import { DataSource } from 'typeorm'

interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
}

export const connectWithRetry = async (
  dataSource: DataSource,
  options: RetryOptions = {}
): Promise<DataSource> => {
  const {
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2
  } = options

  let retryCount = 0
  let delay = initialDelay

  while (retryCount < maxRetries) {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize()
      }
      console.log('Database connected successfully')
      return dataSource
    } catch (error) {
      retryCount++
      console.warn(`Connection attempt ${retryCount} failed:`, error.message)

      if (retryCount >= maxRetries) {
        console.error('Max retries exceeded. Unable to connect to database.')
        throw error
      }

      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw new Error('Unable to connect to database after retries')
}

// Usage
const initializeWithRetry = async () => {
  try {
    await connectWithRetry(AppDataSource, {
      maxRetries: 10,
      initialDelay: 2000,
      maxDelay: 60000,
      backoffFactor: 1.5
    })
  } catch (error) {
    console.error('Failed to initialize database:', error)
    process.exit(1)
  }
}
```

### Query Retry Mechanism

```typescript
// utils/queryRetry.ts
import { Repository } from 'typeorm'

export class RetryableRepository<T> {
  private repository: Repository<T>
  private maxRetries: number
  private retryDelay: number

  constructor(repository: Repository<T>, maxRetries = 3, retryDelay = 1000) {
    this.repository = repository
    this.maxRetries = maxRetries
    this.retryDelay = retryDelay
  }

  async findWithRetry(options: any): Promise<T[]> {
    return this.executeWithRetry(() => this.repository.find(options))
  }

  async saveWithRetry(entity: T): Promise<T> {
    return this.executeWithRetry(() => this.repository.save(entity))
  }

  private async executeWithRetry<R>(operation: () => Promise<R>): Promise<R> {
    let retryCount = 0

    while (retryCount <= this.maxRetries) {
      try {
        return await operation()
      } catch (error) {
        retryCount++
        
        if (retryCount > this.maxRetries) {
          throw error
        }

        // Check if error is retryable
        if (this.isRetryableError(error)) {
          console.warn(`Query failed, retrying (${retryCount}/${this.maxRetries})...`)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryCount))
        } else {
          throw error
        }
      }
    }

    throw new Error('Max retries exceeded')
  }

  private isRetryableError(error: any): boolean {
    // Common retryable errors
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'Connection lost',
      'Connection timeout'
    ]

    return retryableErrors.some(retryableError => 
      error.message?.includes(retryableError) || 
      error.code === retryableError
    )
  }
}
```

## Health Monitoring

### Connection Health Check

```typescript
// utils/healthCheck.ts
import { DataSource } from 'typeorm'

export class DatabaseHealthCheck {
  private dataSources: DataSource[]
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(dataSources: DataSource[]) {
    this.dataSources = dataSources
  }

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    databases: Record<string, any>
  }> {
    const results: Record<string, any> = {}
    let overallStatus: 'healthy' | 'unhealthy' = 'healthy'

    for (const dataSource of this.dataSources) {
      const dbName = dataSource.options.name || 'default'
      
      try {
        const startTime = Date.now()
        
        // Simple health check query
        if (dataSource.options.type === 'mongodb') {
          await dataSource.query('db.runCommand({ ping: 1 })')
        } else {
          await dataSource.query('SELECT 1')
        }
        
        const responseTime = Date.now() - startTime
        
        results[dbName] = {
          status: 'healthy',
          responseTime,
          isInitialized: dataSource.isInitialized,
          timestamp: new Date().toISOString()
        }
      } catch (error) {
        results[dbName] = {
          status: 'unhealthy',
          error: error.message,
          isInitialized: dataSource.isInitialized,
          timestamp: new Date().toISOString()
        }
        overallStatus = 'unhealthy'
      }
    }

    return {
      status: overallStatus,
      databases: results
    }
  }

  startHealthMonitoring(intervalMs: number = 30000): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.checkHealth()
      
      if (health.status === 'unhealthy') {
        console.warn('Database health check failed:', health.databases)
        
        // Attempt to reconnect unhealthy databases
        await this.reconnectUnhealthyDatabases(health.databases)
      }
    }, intervalMs)
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  private async reconnectUnhealthyDatabases(databases: Record<string, any>): Promise<void> {
    for (const [dbName, dbHealth] of Object.entries(databases)) {
      if (dbHealth.status === 'unhealthy') {
        const dataSource = this.dataSources.find(ds => 
          (ds.options.name || 'default') === dbName
        )
        
        if (dataSource) {
          try {
            if (dataSource.isInitialized) {
              await dataSource.destroy()
            }
            await dataSource.initialize()
            console.log(`Reconnected to database: ${dbName}`)
          } catch (error) {
            console.error(`Failed to reconnect to database ${dbName}:`, error.message)
          }
        }
      }
    }
  }
}

// Usage
const healthCheck = new DatabaseHealthCheck([
  AppDataSource,
  AuthDataSource,
  CommerceDataSource
])

healthCheck.startHealthMonitoring(30000) // Check every 30 seconds
```

## Read/Write Splitting

### Master-Slave Configuration

```typescript
// config/masterSlave.ts
import { DataSource } from 'typeorm'

// Master database (write operations)
export const MasterDataSource = new DataSource({
  name: 'master',
  type: 'mysql',
  host: process.env.DB_MASTER_HOST,
  port: parseInt(process.env.DB_MASTER_PORT || '3306'),
  username: process.env.DB_MASTER_USER,
  password: process.env.DB_MASTER_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false
})

// Slave database (read operations)
export const SlaveDataSource = new DataSource({
  name: 'slave',
  type: 'mysql',
  host: process.env.DB_SLAVE_HOST,
  port: parseInt(process.env.DB_SLAVE_PORT || '3306'),
  username: process.env.DB_SLAVE_USER,
  password: process.env.DB_SLAVE_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../entities/*.ts'],
  synchronize: false,
  logging: false
})

// Connection manager
export class DatabaseConnectionManager {
  private master: DataSource
  private slaves: DataSource[]
  private currentSlaveIndex = 0

  constructor(master: DataSource, slaves: DataSource[]) {
    this.master = master
    this.slaves = slaves
  }

  async initialize(): Promise<void> {
    await this.master.initialize()
    await Promise.all(this.slaves.map(slave => slave.initialize()))
  }

  getMasterConnection(): DataSource {
    return this.master
  }

  getSlaveConnection(): DataSource {
    // Round-robin load balancing
    const slave = this.slaves[this.currentSlaveIndex]
    this.currentSlaveIndex = (this.currentSlaveIndex + 1) % this.slaves.length
    return slave
  }

  async destroy(): Promise<void> {
    await this.master.destroy()
    await Promise.all(this.slaves.map(slave => slave.destroy()))
  }
}

// Usage
const connectionManager = new DatabaseConnectionManager(
  MasterDataSource,
  [SlaveDataSource]
)

await connectionManager.initialize()
```

### Repository with Read/Write Splitting

```typescript
// repositories/BaseRepository.ts
import { TypeOrmConnector } from '@goatlab/fluent'
import { DatabaseConnectionManager } from '../config/masterSlave'

export abstract class BaseRepository<T, I, O> extends TypeOrmConnector<T, I, O> {
  private connectionManager: DatabaseConnectionManager

  constructor(
    entity: any,
    connectionManager: DatabaseConnectionManager,
    inputSchema: any,
    outputSchema?: any
  ) {
    // Use master connection for the base
    super({
      entity,
      dataSource: connectionManager.getMasterConnection(),
      inputSchema,
      outputSchema
    })
    
    this.connectionManager = connectionManager
  }

  // Override read operations to use slave
  async findMany(query?: any): Promise<O[]> {
    const slaveConnector = new TypeOrmConnector({
      entity: this.entity,
      dataSource: this.connectionManager.getSlaveConnection(),
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    })
    
    return slaveConnector.findMany(query)
  }

  async findById(id: string): Promise<O | null> {
    const slaveConnector = new TypeOrmConnector({
      entity: this.entity,
      dataSource: this.connectionManager.getSlaveConnection(),
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    })
    
    return slaveConnector.findById(id)
  }

  // Write operations use master (inherited behavior)
  // insert, update, delete methods will use the master connection
}
```

## Connection Middleware

### Express Connection Middleware

```typescript
// middleware/database.ts
import { Request, Response, NextFunction } from 'express'
import { DatabaseConnectionManager } from '../config/masterSlave'

export interface DatabaseRequest extends Request {
  db: {
    master: DataSource
    slave: DataSource
  }
}

export const databaseMiddleware = (connectionManager: DatabaseConnectionManager) => {
  return (req: DatabaseRequest, res: Response, next: NextFunction) => {
    req.db = {
      master: connectionManager.getMasterConnection(),
      slave: connectionManager.getSlaveConnection()
    }
    next()
  }
}

// Usage in routes
app.use(databaseMiddleware(connectionManager))

app.get('/users', async (req: DatabaseRequest, res: Response) => {
  const userRepository = req.db.slave.getRepository(User)
  const users = await userRepository.find()
  res.json(users)
})

app.post('/users', async (req: DatabaseRequest, res: Response) => {
  const userRepository = req.db.master.getRepository(User)
  const user = await userRepository.save(req.body)
  res.json(user)
})
```

## Transaction Management

### Distributed Transactions

```typescript
// utils/transactionManager.ts
import { DataSource, QueryRunner } from 'typeorm'

export class TransactionManager {
  private dataSources: DataSource[]
  private queryRunners: QueryRunner[] = []

  constructor(dataSources: DataSource[]) {
    this.dataSources = dataSources
  }

  async begin(): Promise<void> {
    this.queryRunners = []
    
    for (const dataSource of this.dataSources) {
      const queryRunner = dataSource.createQueryRunner()
      await queryRunner.connect()
      await queryRunner.startTransaction()
      this.queryRunners.push(queryRunner)
    }
  }

  async commit(): Promise<void> {
    for (const queryRunner of this.queryRunners) {
      await queryRunner.commitTransaction()
    }
    await this.cleanup()
  }

  async rollback(): Promise<void> {
    for (const queryRunner of this.queryRunners) {
      await queryRunner.rollbackTransaction()
    }
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    for (const queryRunner of this.queryRunners) {
      await queryRunner.release()
    }
    this.queryRunners = []
  }

  getQueryRunner(dataSourceName: string): QueryRunner {
    const index = this.dataSources.findIndex(ds => 
      (ds.options.name || 'default') === dataSourceName
    )
    return this.queryRunners[index]
  }
}

// Usage
const transactionManager = new TransactionManager([
  AuthDataSource,
  CommerceDataSource
])

try {
  await transactionManager.begin()
  
  // Perform operations across multiple databases
  const authQueryRunner = transactionManager.getQueryRunner('auth')
  const commerceQueryRunner = transactionManager.getQueryRunner('commerce')
  
  await authQueryRunner.manager.save(User, userData)
  await commerceQueryRunner.manager.save(Order, orderData)
  
  await transactionManager.commit()
} catch (error) {
  await transactionManager.rollback()
  throw error
}
```

## Environment-Based Configuration

### Configuration Factory

```typescript
// config/connectionFactory.ts
import { DataSource } from 'typeorm'

interface DatabaseConfig {
  type: 'mysql' | 'postgres' | 'mongodb' | 'sqlite'
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
  url?: string
  ssl?: boolean
  poolSize?: number
}

export class ConnectionFactory {
  static create(name: string, config: DatabaseConfig, entities: any[]): DataSource {
    const baseConfig = {
      name,
      entities,
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      migrations: [__dirname + '/../migrations/*.ts']
    }

    switch (config.type) {
      case 'mysql':
        return new DataSource({
          ...baseConfig,
          type: 'mysql',
          host: config.host,
          port: config.port || 3306,
          username: config.username,
          password: config.password,
          database: config.database,
          extra: {
            connectionLimit: config.poolSize || 10,
            ssl: config.ssl ? { rejectUnauthorized: false } : false
          }
        })

      case 'postgres':
        return new DataSource({
          ...baseConfig,
          type: 'postgres',
          host: config.host,
          port: config.port || 5432,
          username: config.username,
          password: config.password,
          database: config.database,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
          extra: {
            max: config.poolSize || 10
          }
        })

      case 'mongodb':
        return new DataSource({
          ...baseConfig,
          type: 'mongodb',
          url: config.url,
          extra: {
            maxPoolSize: config.poolSize || 10,
            ssl: config.ssl
          }
        })

      case 'sqlite':
        return new DataSource({
          ...baseConfig,
          type: 'sqlite',
          database: config.database || './database.sqlite'
        })

      default:
        throw new Error(`Unsupported database type: ${config.type}`)
    }
  }
}

// Usage
const connections = {
  auth: ConnectionFactory.create('auth', {
    type: 'postgres',
    host: process.env.AUTH_DB_HOST,
    port: parseInt(process.env.AUTH_DB_PORT),
    username: process.env.AUTH_DB_USER,
    password: process.env.AUTH_DB_PASSWORD,
    database: process.env.AUTH_DB_NAME,
    ssl: process.env.NODE_ENV === 'production',
    poolSize: 20
  }, [User, Role]),
  
  commerce: ConnectionFactory.create('commerce', {
    type: 'mysql',
    host: process.env.COMMERCE_DB_HOST,
    port: parseInt(process.env.COMMERCE_DB_PORT),
    username: process.env.COMMERCE_DB_USER,
    password: process.env.COMMERCE_DB_PASSWORD,
    database: process.env.COMMERCE_DB_NAME,
    ssl: process.env.NODE_ENV === 'production',
    poolSize: 15
  }, [Product, Order])
}
```

This comprehensive guide covers various connection management patterns for building robust, scalable applications with Goat Fluent, including proper connection lifecycle management, pooling strategies, retry mechanisms, and health monitoring.
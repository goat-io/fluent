# Integration Testing

Integration testing in the Fluent ecosystem ensures that different components work together correctly, particularly focusing on database connections, external services, and inter-package communication.

## Overview

Integration tests verify that:
- Database connectors work with actual databases
- APIs integrate correctly with external services
- Packages interact properly within the monorepo
- Configuration and environment setup works correctly

## Database Integration Testing

### TypeORM Integration

The Fluent ecosystem primarily uses TypeORM for database operations. Integration tests ensure proper database connectivity and query execution.

#### Setup Example

```typescript
// setup.ts
import { DataSource } from 'typeorm'
import { User } from './entities/User'

export let testDataSource: DataSource

beforeAll(async () => {
  testDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [User],
    synchronize: true,
    logging: false
  })
  
  await testDataSource.initialize()
})

afterAll(async () => {
  await testDataSource.destroy()
})
```

#### Database Test Patterns

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TypeOrmConnector } from '@goatlab/fluent'
import { testDataSource } from './setup'

describe('TypeORM Integration', () => {
  let connector: TypeOrmConnector

  beforeAll(async () => {
    connector = new TypeOrmConnector({
      dataSource: testDataSource
    })
  })

  it('should connect to database', async () => {
    const isConnected = await connector.isConnected()
    expect(isConnected).toBe(true)
  })

  it('should create and query entities', async () => {
    const user = await connector.create('User', {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    })

    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')

    const foundUser = await connector.findOne('User', { 
      where: { email: 'test@example.com' } 
    })

    expect(foundUser?.id).toBe(user.id)
  })

  it('should handle complex queries', async () => {
    // Create test data
    await connector.create('User', {
      email: 'user1@example.com',
      firstName: 'John',
      lastName: 'Doe',
      age: 30
    })

    await connector.create('User', {
      email: 'user2@example.com', 
      firstName: 'Jane',
      lastName: 'Smith',
      age: 25
    })

    const users = await connector.find('User', {
      where: { age: { $gte: 25 } },
      orderBy: { age: 'ASC' }
    })

    expect(users).toHaveLength(2)
    expect(users[0].age).toBe(25)
    expect(users[1].age).toBe(30)
  })
})
```

### Multi-Database Testing

```typescript
describe('Multi-Database Support', () => {
  const databases = [
    { name: 'MySQL', config: { type: 'mysql', host: 'localhost' } },
    { name: 'PostgreSQL', config: { type: 'postgres', host: 'localhost' } },
    { name: 'SQLite', config: { type: 'sqlite', database: ':memory:' } }
  ]

  databases.forEach(({ name, config }) => {
    describe(`${name} Integration`, () => {
      let connector: TypeOrmConnector

      beforeAll(async () => {
        const dataSource = new DataSource({
          ...config,
          entities: [User],
          synchronize: true
        })

        await dataSource.initialize()
        connector = new TypeOrmConnector({ dataSource })
      })

      it('should perform basic CRUD operations', async () => {
        const user = await connector.create('User', {
          email: `${name.toLowerCase()}@example.com`,
          firstName: 'Test',
          lastName: 'User'
        })

        expect(user.id).toBeDefined()

        const updated = await connector.update('User', user.id, {
          firstName: 'Updated'
        })

        expect(updated.firstName).toBe('Updated')

        await connector.delete('User', user.id)

        const deleted = await connector.findOne('User', { 
          where: { id: user.id } 
        })
        
        expect(deleted).toBeNull()
      })
    })
  })
})
```

## Connector Integration Testing

### Firebase Connector

```typescript
import { FirebaseConnector } from '@goatlab/fluent-firebase'

describe('Firebase Integration', () => {
  let connector: FirebaseConnector

  beforeAll(async () => {
    connector = new FirebaseConnector({
      projectId: 'test-project',
      // Use Firebase emulator for testing
      host: 'localhost:8080',
      ssl: false
    })
  })

  it('should connect to Firestore', async () => {
    const isConnected = await connector.isConnected()
    expect(isConnected).toBe(true)
  })

  it('should handle document operations', async () => {
    const doc = await connector.create('users', {
      name: 'Test User',
      email: 'test@example.com'
    })

    expect(doc.id).toBeDefined()

    const found = await connector.findOne('users', { 
      where: { email: 'test@example.com' } 
    })

    expect(found?.name).toBe('Test User')
  })

  it('should handle real-time subscriptions', async () => {
    const updates: any[] = []

    const unsubscribe = connector.subscribe('users', (snapshot) => {
      updates.push(snapshot.data())
    })

    await connector.create('users', {
      name: 'Real-time User',
      email: 'realtime@example.com'
    })

    // Wait for real-time update
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(updates).toHaveLength(1)
    expect(updates[0].name).toBe('Real-time User')

    unsubscribe()
  })
})
```

### LokiJS Connector

```typescript
import { LokiConnector } from '@goatlab/fluent-loki'

describe('LokiJS Integration', () => {
  let connector: LokiConnector

  beforeAll(async () => {
    connector = new LokiConnector({
      filename: ':memory:',
      collections: ['users', 'posts']
    })
  })

  it('should handle in-memory operations', async () => {
    const user = await connector.create('users', {
      name: 'Memory User',
      email: 'memory@example.com'
    })

    expect(user.$loki).toBeDefined()

    const found = await connector.findOne('users', {
      where: { email: 'memory@example.com' }
    })

    expect(found?.name).toBe('Memory User')
  })

  it('should handle complex queries', async () => {
    // Create test data
    await connector.create('users', { name: 'User 1', score: 100 })
    await connector.create('users', { name: 'User 2', score: 200 })
    await connector.create('users', { name: 'User 3', score: 150 })

    const highScoreUsers = await connector.find('users', {
      where: { score: { $gt: 120 } },
      orderBy: { score: 'DESC' }
    })

    expect(highScoreUsers).toHaveLength(2)
    expect(highScoreUsers[0].score).toBe(200)
    expect(highScoreUsers[1].score).toBe(150)
  })
})
```

## API Integration Testing

### REST API Testing

```typescript
import { FluentAPI } from '@goatlab/fluent'
import request from 'supertest'

describe('REST API Integration', () => {
  let app: Express.Application
  let api: FluentAPI

  beforeAll(async () => {
    api = new FluentAPI({
      connector: testConnector,
      entities: [User, Post]
    })

    app = api.createExpressApp()
  })

  it('should handle CRUD operations via REST', async () => {
    // Create user
    const createResponse = await request(app)
      .post('/api/users')
      .send({
        email: 'api@example.com',
        firstName: 'API',
        lastName: 'User'
      })
      .expect(201)

    const userId = createResponse.body.id

    // Get user
    const getResponse = await request(app)
      .get(`/api/users/${userId}`)
      .expect(200)

    expect(getResponse.body.email).toBe('api@example.com')

    // Update user
    const updateResponse = await request(app)
      .put(`/api/users/${userId}`)
      .send({ firstName: 'Updated' })
      .expect(200)

    expect(updateResponse.body.firstName).toBe('Updated')

    // Delete user
    await request(app)
      .delete(`/api/users/${userId}`)
      .expect(204)

    // Verify deletion
    await request(app)
      .get(`/api/users/${userId}`)
      .expect(404)
  })

  it('should handle query parameters', async () => {
    // Create test data
    await request(app)
      .post('/api/users')
      .send({ email: 'user1@example.com', age: 25 })

    await request(app)
      .post('/api/users')
      .send({ email: 'user2@example.com', age: 30 })

    // Query with filters
    const response = await request(app)
      .get('/api/users')
      .query({ age: { $gte: 25 }, limit: 10 })
      .expect(200)

    expect(response.body.data).toHaveLength(2)
    expect(response.body.total).toBe(2)
  })
})
```

### GraphQL Integration

```typescript
import { FluentGraphQL } from '@goatlab/fluent'
import { graphql } from 'graphql'

describe('GraphQL Integration', () => {
  let schema: GraphQLSchema

  beforeAll(async () => {
    const fluentGQL = new FluentGraphQL({
      connector: testConnector,
      entities: [User, Post]
    })

    schema = fluentGQL.buildSchema()
  })

  it('should handle GraphQL queries', async () => {
    // Create test data
    await testConnector.create('User', {
      email: 'graphql@example.com',
      firstName: 'GraphQL',
      lastName: 'User'
    })

    const query = `
      query {
        users(where: { email: "graphql@example.com" }) {
          id
          email
          firstName
          lastName
        }
      }
    `

    const result = await graphql(schema, query)

    expect(result.errors).toBeUndefined()
    expect(result.data?.users).toHaveLength(1)
    expect(result.data?.users[0].email).toBe('graphql@example.com')
  })

  it('should handle GraphQL mutations', async () => {
    const mutation = `
      mutation {
        createUser(input: {
          email: "mutation@example.com"
          firstName: "Mutation"
          lastName: "User"
        }) {
          id
          email
          firstName
        }
      }
    `

    const result = await graphql(schema, mutation)

    expect(result.errors).toBeUndefined()
    expect(result.data?.createUser.email).toBe('mutation@example.com')
  })
})
```

## Queue Integration Testing

```typescript
import { QueueManager } from '@goatlab/queue-core'
import { FastQBroker } from '@goatlab/queue-core'

describe('Queue Integration', () => {
  let queueManager: QueueManager
  let broker: FastQBroker

  beforeAll(async () => {
    broker = new FastQBroker()
    queueManager = new QueueManager({ broker })
    
    await queueManager.start()
  })

  afterAll(async () => {
    await queueManager.stop()
  })

  it('should handle job processing', async () => {
    let processedJob: any = null

    // Define job processor
    queueManager.addProcessor('test-job', async (job) => {
      processedJob = job
      return { success: true }
    })

    // Add job to queue
    await queueManager.addJob('test-job', {
      userId: 123,
      action: 'send-email'
    })

    // Wait for job processing
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(processedJob).toBeDefined()
    expect(processedJob.data.userId).toBe(123)
    expect(processedJob.data.action).toBe('send-email')
  })

  it('should handle job failure and retries', async () => {
    let attemptCount = 0

    queueManager.addProcessor('failing-job', async (job) => {
      attemptCount++
      
      if (attemptCount < 3) {
        throw new Error('Job failed')
      }
      
      return { success: true, attempts: attemptCount }
    })

    await queueManager.addJob('failing-job', { test: 'data' }, {
      retries: 3,
      retryDelay: 10
    })

    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(attemptCount).toBe(3)
  })
})
```

## File Upload Integration Testing

```typescript
import { UploadManager } from '@goatlab/uploads'
import { S3Provider } from '@goatlab/uploads'

describe('Upload Integration', () => {
  let uploadManager: UploadManager

  beforeAll(async () => {
    uploadManager = new UploadManager({
      provider: new S3Provider({
        bucket: 'test-bucket',
        region: 'us-east-1',
        // Use localstack for testing
        endpoint: 'http://localhost:4566'
      })
    })
  })

  it('should upload files to S3', async () => {
    const fileBuffer = Buffer.from('test file content')
    const fileName = 'test-file.txt'

    const result = await uploadManager.upload({
      file: fileBuffer,
      fileName,
      contentType: 'text/plain'
    })

    expect(result.url).toBeDefined()
    expect(result.key).toBe(fileName)
  })

  it('should handle file metadata', async () => {
    const fileBuffer = Buffer.from('test content')
    
    const result = await uploadManager.upload({
      file: fileBuffer,
      fileName: 'metadata-test.txt',
      metadata: {
        userId: '123',
        uploadType: 'document'
      }
    })

    const metadata = await uploadManager.getMetadata(result.key)
    expect(metadata.userId).toBe('123')
    expect(metadata.uploadType).toBe('document')
  })
})
```

## Environment Configuration Testing

```typescript
describe('Environment Configuration', () => {
  it('should load configuration from environment', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
    process.env.REDIS_URL = 'redis://localhost:6379'
    
    const config = loadConfiguration()
    
    expect(config.database.url).toBe('postgresql://test:test@localhost/test')
    expect(config.redis.url).toBe('redis://localhost:6379')
  })

  it('should validate required environment variables', () => {
    delete process.env.DATABASE_URL
    
    expect(() => loadConfiguration()).toThrow('DATABASE_URL is required')
  })

  it('should use default values for optional variables', () => {
    delete process.env.LOG_LEVEL
    
    const config = loadConfiguration()
    expect(config.logLevel).toBe('info')
  })
})
```

## Performance Testing Integration

```typescript
import { performance } from 'perf_hooks'

describe('Performance Integration', () => {
  it('should handle high-volume operations', async () => {
    const startTime = performance.now()
    
    // Create 1000 users
    const promises = Array.from({ length: 1000 }, (_, i) => 
      connector.create('User', {
        email: `user${i}@example.com`,
        firstName: `User${i}`,
        lastName: 'Test'
      })
    )

    const users = await Promise.all(promises)
    const endTime = performance.now()

    expect(users).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(5000) // Less than 5 seconds
  })

  it('should handle concurrent operations', async () => {
    const concurrentOperations = 100
    const startTime = performance.now()

    const promises = Array.from({ length: concurrentOperations }, (_, i) => 
      connector.find('User', {
        where: { email: { $like: '%example.com' } },
        limit: 10
      })
    )

    const results = await Promise.all(promises)
    const endTime = performance.now()

    expect(results).toHaveLength(concurrentOperations)
    expect(endTime - startTime).toBeLessThan(2000) // Less than 2 seconds
  })
})
```

## CI/CD Integration Testing

```typescript
describe('CI/CD Integration', () => {
  it('should run in CI environment', () => {
    const isCI = process.env.CI === 'true'
    
    if (isCI) {
      // Skip tests that require external services not available in CI
      expect(true).toBe(true)
    } else {
      // Run full integration tests in local environment
      expect(connector.isConnected()).toBe(true)
    }
  })

  it('should handle Docker environment', async () => {
    if (process.env.DOCKER_ENV === 'true') {
      // Use Docker-specific database URLs
      const config = {
        host: 'db',
        port: 5432,
        database: 'test_db'
      }
      
      const dockerConnector = new TypeOrmConnector(config)
      await dockerConnector.connect()
      
      expect(dockerConnector.isConnected()).toBe(true)
    }
  })
})
```

## Test Data Management

```typescript
class TestDataManager {
  private createdEntities: Map<string, any[]> = new Map()

  async createUser(data: Partial<User>): Promise<User> {
    const user = await connector.create('User', {
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      ...data
    })

    this.trackEntity('User', user)
    return user
  }

  async createPost(userId: string, data: Partial<Post>): Promise<Post> {
    const post = await connector.create('Post', {
      title: 'Test Post',
      content: 'Test content',
      userId,
      ...data
    })

    this.trackEntity('Post', post)
    return post
  }

  private trackEntity(entityType: string, entity: any) {
    if (!this.createdEntities.has(entityType)) {
      this.createdEntities.set(entityType, [])
    }
    this.createdEntities.get(entityType)!.push(entity)
  }

  async cleanup() {
    for (const [entityType, entities] of this.createdEntities) {
      for (const entity of entities) {
        await connector.delete(entityType, entity.id)
      }
    }
    this.createdEntities.clear()
  }
}

describe('Integration with Test Data Management', () => {
  let testDataManager: TestDataManager

  beforeEach(() => {
    testDataManager = new TestDataManager()
  })

  afterEach(async () => {
    await testDataManager.cleanup()
  })

  it('should handle user-post relationships', async () => {
    const user = await testDataManager.createUser({
      email: 'author@example.com'
    })

    const post = await testDataManager.createPost(user.id, {
      title: 'Integration Test Post'
    })

    const userWithPosts = await connector.findOne('User', {
      where: { id: user.id },
      relations: ['posts']
    })

    expect(userWithPosts?.posts).toHaveLength(1)
    expect(userWithPosts?.posts[0].title).toBe('Integration Test Post')
  })
})
```

## Best Practices

### 1. Test Database Isolation
- Use separate test databases
- Clean up data between tests
- Use transactions for rollback

### 2. Mock External Services
- Mock third-party APIs
- Use test doubles for external dependencies
- Provide offline testing capabilities

### 3. Environment Configuration
- Use environment-specific configurations
- Validate required settings
- Provide sensible defaults

### 4. Performance Considerations
- Set appropriate timeouts
- Monitor test execution time
- Use connection pooling

### 5. Data Management
- Create minimal test data
- Use factories for consistent data creation
- Clean up resources after tests

### 6. Error Handling
- Test error scenarios
- Validate error messages
- Ensure proper cleanup on failures

This comprehensive integration testing guide ensures that all components of the Fluent ecosystem work together correctly in real-world scenarios.
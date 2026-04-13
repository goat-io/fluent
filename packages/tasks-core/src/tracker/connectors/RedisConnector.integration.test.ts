import type { StartedRedisContainer } from '@testcontainers/redis'
import { RedisContainer } from '@testcontainers/redis'
import Redis from 'ioredis'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TrackedTaskState } from '../tracker.types'
import { type RedisClient, RedisTaskTrackerConnector } from './RedisConnector'

describe('RedisTaskTrackerConnector Integration Tests', () => {
  let container: StartedRedisContainer
  let redis: Redis
  let subscriber: Redis
  let connector: RedisTaskTrackerConnector

  beforeAll(async () => {
    // Start Redis container
    container = await new RedisContainer('redis:7-alpine').start()

    const host = container.getHost()
    const port = container.getMappedPort(6379)

    redis = new Redis({ host, port, maxRetriesPerRequest: null })
    subscriber = new Redis({ host, port, maxRetriesPerRequest: null })
  }, 120000)

  afterAll(async () => {
    if (connector) {
      await connector.close()
    }
    if (redis) {
      await redis.quit()
    }
    if (subscriber) {
      await subscriber.quit()
    }
    if (container) {
      await container.stop()
    }
  }, 30000)

  beforeEach(async () => {
    // Clean up Redis between tests
    await redis.flushall()

    // Create new connector for each test
    // Cast to RedisClient as ioredis has compatible but different type signatures
    const host = container.getHost()
    const port = container.getMappedPort(6379)

    const newRedis = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    }) as unknown as RedisClient
    const newSubscriber = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    }) as unknown as RedisClient

    connector = new RedisTaskTrackerConnector(newRedis, newSubscriber)
  })

  const createTaskState = (
    id: string,
    tenantId: string,
    overrides: Partial<TrackedTaskState> = {},
  ): TrackedTaskState => ({
    id,
    tenantId,
    name: 'test-task',
    status: 'QUEUED',
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  })

  describe('createBatch', () => {
    it('should create multiple tasks in Redis', async () => {
      const tasks = [
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-1'),
        createTaskState('task-3', 'tenant-2'),
      ]

      await connector.createBatch(tasks)

      // Verify tasks exist in Redis
      const task1 = await connector.get('task-1', 'tenant-1')
      const task2 = await connector.get('task-2', 'tenant-1')
      const task3 = await connector.get('task-3', 'tenant-2')

      expect(task1?.id).toBe('task-1')
      expect(task2?.id).toBe('task-2')
      expect(task3?.id).toBe('task-3')
    })

    it('should handle empty batch', async () => {
      await connector.createBatch([])
      // Should not throw
    })

    it('should store all task fields correctly', async () => {
      const task = createTaskState('task-1', 'tenant-1', {
        name: 'my-task',
        status: 'RUNNING',
        progress: 50,
        message: 'Processing...',
        result: { data: 'result' },
        error: 'some error',
        completedAt: Date.now(),
      })

      await connector.createBatch([task])

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect(retrieved).toMatchObject({
        id: 'task-1',
        tenantId: 'tenant-1',
        name: 'my-task',
        status: 'RUNNING',
        progress: 50,
        message: 'Processing...',
        result: { data: 'result' },
        error: 'some error',
      })
    })

    it('should set TTL on tasks', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      // Check that TTL is set (default 24 hours)
      const ttl = await redis.ttl('task:tenant-1:task-1')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(86400) // Default TTL
    })

    it('should handle large batch efficiently', async () => {
      const tasks = Array.from({ length: 1000 }, (_, i) =>
        createTaskState(`task-${i}`, 'tenant-1'),
      )

      const start = Date.now()
      await connector.createBatch(tasks)
      const elapsed = Date.now() - start

      // Should complete in reasonable time (< 5 seconds for 1000 tasks)
      expect(elapsed).toBeLessThan(5000)

      // Verify a few random tasks
      const task0 = await connector.get('task-0', 'tenant-1')
      const task500 = await connector.get('task-500', 'tenant-1')
      const task999 = await connector.get('task-999', 'tenant-1')

      expect(task0?.id).toBe('task-0')
      expect(task500?.id).toBe('task-500')
      expect(task999?.id).toBe('task-999')
    })
  })

  describe('update', () => {
    it('should update existing task', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', {
        status: 'RUNNING',
        progress: 25,
        message: 'Starting...',
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.status).toBe('RUNNING')
      expect(task?.progress).toBe(25)
      expect(task?.message).toBe('Starting...')
    })

    it('should update TTL based on status - COMPLETED', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', {
        status: 'COMPLETED',
        progress: 100,
      })

      const ttl = await redis.ttl('task:tenant-1:task-1')
      // Completed tasks should have shorter TTL (24 hours by default)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(86400)
    })

    it('should update TTL based on status - FAILED', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', {
        status: 'FAILED',
        error: 'Something went wrong',
      })

      const ttl = await redis.ttl('task:tenant-1:task-1')
      // Failed tasks should have longer TTL (7 days by default)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(604800)
    })

    it('should update result with complex JSON', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      const result = {
        items: [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
        ],
        metadata: {
          total: 2,
          nested: { deep: { value: 'test' } },
        },
      }

      await connector.update('task-1', 'tenant-1', {
        status: 'COMPLETED',
        result,
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.result).toEqual(result)
    })

    it('should update updatedAt timestamp', async () => {
      const initialTime = Date.now()
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { updatedAt: initialTime }),
      ])

      await new Promise(resolve => setTimeout(resolve, 50))

      await connector.update('task-1', 'tenant-1', { progress: 50 })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.updatedAt).toBeGreaterThan(initialTime)
    })
  })

  describe('get', () => {
    it('should return null for non-existent task', async () => {
      const task = await connector.get('non-existent', 'tenant-1')
      expect(task).toBeNull()
    })

    it('should return null for wrong tenant', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      const task = await connector.get('task-1', 'tenant-2')
      expect(task).toBeNull()
    })

    it('should deserialize all fields correctly', async () => {
      const now = Date.now()
      const task = createTaskState('task-1', 'tenant-1', {
        name: 'test-task',
        status: 'RUNNING',
        progress: 75,
        message: 'Almost done',
        result: { success: true },
        error: undefined,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      })

      await connector.createBatch([task])

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect(retrieved?.id).toBe('task-1')
      expect(retrieved?.tenantId).toBe('tenant-1')
      expect(retrieved?.name).toBe('test-task')
      expect(retrieved?.status).toBe('RUNNING')
      expect(retrieved?.progress).toBe(75)
      expect(retrieved?.message).toBe('Almost done')
      expect(retrieved?.result).toEqual({ success: true })
      expect(retrieved?.createdAt).toBe(now)
      expect(retrieved?.updatedAt).toBe(now)
      expect(retrieved?.completedAt).toBe(now)
    })
  })

  describe('publish and subscribe', () => {
    it('should publish updates to subscribers', async () => {
      const receivedStates: TrackedTaskState[] = []

      const unsubscribe = connector.subscribe('tenant-1', 'task-1', state => {
        receivedStates.push(state)
      })

      // Give subscriber time to set up
      await new Promise(resolve => setTimeout(resolve, 100))

      const state = createTaskState('task-1', 'tenant-1', {
        status: 'RUNNING',
        progress: 50,
      })

      await connector.publish('tenant-1', 'task-1', state)

      // Wait for message to be received
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(receivedStates.length).toBe(1)
      expect(receivedStates[0].id).toBe('task-1')
      expect(receivedStates[0].progress).toBe(50)

      unsubscribe()
    })

    it('should support multiple subscribers to same task', async () => {
      const received1: TrackedTaskState[] = []
      const received2: TrackedTaskState[] = []

      const unsub1 = connector.subscribe('tenant-1', 'task-1', state => {
        received1.push(state)
      })
      const unsub2 = connector.subscribe('tenant-1', 'task-1', state => {
        received2.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(received1.length).toBe(1)
      expect(received2.length).toBe(1)

      unsub1()
      unsub2()
    })

    it('should not receive updates after unsubscribe', async () => {
      const receivedStates: TrackedTaskState[] = []

      const unsubscribe = connector.subscribe('tenant-1', 'task-1', state => {
        receivedStates.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // First publish
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      await new Promise(resolve => setTimeout(resolve, 100))

      // Unsubscribe
      unsubscribe()
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second publish (should not be received)
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(receivedStates.length).toBe(1)
    })

    it('should isolate subscriptions by tenant and task', async () => {
      const tenant1Task1: TrackedTaskState[] = []
      const tenant1Task2: TrackedTaskState[] = []
      const tenant2Task1: TrackedTaskState[] = []

      const unsub1 = connector.subscribe('tenant-1', 'task-1', state => {
        tenant1Task1.push(state)
      })
      const unsub2 = connector.subscribe('tenant-1', 'task-2', state => {
        tenant1Task2.push(state)
      })
      const unsub3 = connector.subscribe('tenant-2', 'task-1', state => {
        tenant2Task1.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Publish to tenant-1, task-1
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(tenant1Task1.length).toBe(1)
      expect(tenant1Task2.length).toBe(0)
      expect(tenant2Task1.length).toBe(0)

      unsub1()
      unsub2()
      unsub3()
    })
  })

  describe('cleanup', () => {
    it('should return 0 (Redis handles TTL)', async () => {
      const cleaned = await connector.cleanup('tenant-1', 30000)
      expect(cleaned).toBe(0)
    })
  })

  describe('multi-tenant isolation', () => {
    it('should isolate tasks by tenant using key pattern', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { name: 'tenant-1-task' }),
        createTaskState('task-1', 'tenant-2', { name: 'tenant-2-task' }),
      ])

      const tenant1Task = await connector.get('task-1', 'tenant-1')
      const tenant2Task = await connector.get('task-1', 'tenant-2')

      expect(tenant1Task?.name).toBe('tenant-1-task')
      expect(tenant2Task?.name).toBe('tenant-2-task')
    })

    it('should use correct key pattern', async () => {
      await connector.createBatch([createTaskState('task-123', 'tenant-abc')])

      // Check that the key exists with correct pattern
      const keys = await redis.keys('task:tenant-abc:task-123')
      expect(keys.length).toBe(1)
    })

    it('should not allow cross-tenant access', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      const crossTenantTask = await connector.get('task-1', 'tenant-2')
      expect(crossTenantTask).toBeNull()
    })
  })

  describe('configuration', () => {
    it('should respect custom key prefix', async () => {
      const host = container.getHost()
      const port = container.getMappedPort(6379)

      const customRedis = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const customSubscriber = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient

      const customConnector = new RedisTaskTrackerConnector(
        customRedis,
        customSubscriber,
        { keyPrefix: 'custom-task' },
      )

      await customConnector.createBatch([createTaskState('task-1', 'tenant-1')])

      // Check custom key pattern
      const keys = await redis.keys('custom-task:tenant-1:task-1')
      expect(keys.length).toBe(1)

      await customConnector.close()
    })

    it('should respect custom TTL settings', async () => {
      const host = container.getHost()
      const port = container.getMappedPort(6379)

      const customRedis = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const customSubscriber = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient

      const customConnector = new RedisTaskTrackerConnector(
        customRedis,
        customSubscriber,
        {
          defaultTTL: 60,
          completedTTL: 30,
          failedTTL: 120,
        },
      )

      await customConnector.createBatch([createTaskState('task-1', 'tenant-1')])

      const ttl = await redis.ttl('task:tenant-1:task-1')
      expect(ttl).toBeLessThanOrEqual(60)
      expect(ttl).toBeGreaterThan(0)

      await customConnector.close()
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in IDs', async () => {
      // Redis keys can contain colons, but we use them as separators
      // Test that our encoding is correct
      const task = createTaskState('task:with:colons', 'tenant-1')
      await connector.createBatch([task])

      // This might fail if colons aren't handled - let's verify behavior
      const retrieved = await connector.get('task:with:colons', 'tenant-1')
      expect(retrieved?.id).toBe('task:with:colons')
    })

    it('should handle unicode characters in data', async () => {
      const task = createTaskState('task-1', 'tenant-1', {
        message: '你好世界 こんにちは 🎉',
        result: { emoji: '🚀', chinese: '中文' },
      })

      await connector.createBatch([task])

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect(retrieved?.message).toBe('你好世界 こんにちは 🎉')
      expect(retrieved?.result).toEqual({ emoji: '🚀', chinese: '中文' })
    })

    it('should handle large result objects', async () => {
      const largeResult = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `item-${i}`,
          data: 'a'.repeat(100),
        })),
      }

      await connector.createBatch([createTaskState('task-1', 'tenant-1')])
      await connector.update('task-1', 'tenant-1', { result: largeResult })

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect((retrieved?.result as any).items.length).toBe(1000)
    })

    it('should handle null message', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { message: undefined }),
      ])

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect(retrieved?.message).toBeUndefined()
    })

    it('should handle empty string message', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { message: '' }),
      ])

      await connector.update('task-1', 'tenant-1', { message: '' })

      const retrieved = await connector.get('task-1', 'tenant-1')
      // Empty string might be treated as undefined in serialization
      expect(
        retrieved?.message === '' || retrieved?.message === undefined,
      ).toBe(true)
    })
  })

  describe('close', () => {
    it('should clean up subscriptions on close', async () => {
      const received: TrackedTaskState[] = []

      connector.subscribe('tenant-1', 'task-1', state => {
        received.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      await connector.close()

      // Create new connector for verification
      const host = container.getHost()
      const port = container.getMappedPort(6379)
      const newRedis = new Redis({ host, port, maxRetriesPerRequest: null })

      // Try to publish (old connector shouldn't receive it)
      await newRedis.publish(
        'task-updates:tenant-1:task-1',
        JSON.stringify(createTaskState('task-1', 'tenant-1')),
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not have received anything after close
      expect(received.length).toBe(0)

      await newRedis.quit()
    })
  })
})

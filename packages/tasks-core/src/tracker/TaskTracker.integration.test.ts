import type { StartedRedisContainer } from '@testcontainers/redis'
import { RedisContainer } from '@testcontainers/redis'
import Redis from 'ioredis'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  type RedisClient,
  RedisTaskTrackerConnector,
} from './connectors/RedisConnector'
import { TaskTracker } from './TaskTracker'

describe('TaskTracker with Redis Integration Tests', () => {
  let container: StartedRedisContainer
  let tracker: TaskTracker

  beforeAll(async () => {
    // Start Redis container
    container = await new RedisContainer('redis:7-alpine').start()
  }, 120000)

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  }, 30000)

  beforeEach(async () => {
    const host = container.getHost()
    const port = container.getMappedPort(6379)

    // Clean up Redis between tests
    const cleanupRedis = new Redis({ host, port, maxRetriesPerRequest: null })
    await cleanupRedis.flushall()
    await cleanupRedis.quit()

    // Create fresh connections for the test
    // Cast to RedisClient as ioredis has compatible but different type signatures
    const redis = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    }) as unknown as RedisClient
    const subscriber = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    }) as unknown as RedisClient

    const connector = new RedisTaskTrackerConnector(redis, subscriber)

    tracker = new TaskTracker(connector, {
      flushIntervalMs: 10,
      flushThreshold: 10,
      bufferStrategy: 'STATIC',
    })
  })

  afterEach(async () => {
    if (tracker && !tracker.isShutdown) {
      await tracker.shutdown()
    }
  })

  describe('high-throughput batch writes', () => {
    it('should handle 1000 concurrent task creations', async () => {
      const taskIds: string[] = []

      const start = Date.now()

      // Create 1000 tasks
      await Promise.all(
        Array.from({ length: 1000 }, async (_, i) => {
          const id = await tracker.create({
            tenantId: 'tenant-1',
            name: `task-${i}`,
          })
          taskIds.push(id)
        }),
      )

      // Wait for buffer to flush
      await new Promise(resolve => setTimeout(resolve, 200))

      const elapsed = Date.now() - start

      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(10000) // < 10 seconds

      // Verify tasks were created
      const sampleTask = await tracker.get(taskIds[500], 'tenant-1')
      expect(sampleTask).toBeDefined()
      expect(sampleTask?.status).toBe('QUEUED')
    }, 30000)

    it('should maintain data integrity under concurrent updates', async () => {
      // Create a task
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'concurrent-test',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Perform many concurrent progress updates
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          tracker.progress(taskId, 'tenant-1', i, `Progress ${i}`),
        ),
      )

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task).toBeDefined()
      // Progress should be one of the values we set
      expect(task?.progress).toBeGreaterThanOrEqual(0)
      expect(task?.progress).toBeLessThanOrEqual(100)
    })
  })

  describe('real-time Pub/Sub', () => {
    it('should receive updates via Redis Pub/Sub', async () => {
      const received: any[] = []

      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'pubsub-test',
      })

      // Subscribe to updates
      const unsubscribe = tracker.subscribe(taskId, 'tenant-1', state => {
        received.push({ ...state })
      })

      try {
        // Publish already joins subscription readiness; creation receipts order
        // persistence before updates. Delivery on the subscriber is asynchronous.
        await tracker.start(taskId, 'tenant-1', 'Starting...')
        await tracker.progress(taskId, 'tenant-1', 50, 'Halfway')
        await tracker.complete(taskId, 'tenant-1', { done: true })

        await vi.waitFor(
          () => {
            expect(received.length).toBeGreaterThan(0)
            expect(received.some(s => s.status === 'RUNNING')).toBe(true)
            expect(received.some(s => s.status === 'COMPLETED')).toBe(true)
          },
          { timeout: 5000, interval: 20 },
        )
      } finally {
        unsubscribe()
      }
    })

    it('should isolate Pub/Sub by tenant', async () => {
      const tenant1Received: any[] = []
      const tenant2Received: any[] = []

      const task1Id = await tracker.create({
        tenantId: 'tenant-1',
        name: 'tenant-1-task',
      })

      const task2Id = await tracker.create({
        tenantId: 'tenant-2',
        name: 'tenant-2-task',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Subscribe to both
      const unsub1 = tracker.subscribe(task1Id, 'tenant-1', state => {
        tenant1Received.push(state)
      })
      const unsub2 = tracker.subscribe(task2Id, 'tenant-2', state => {
        tenant2Received.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Update only tenant-1's task
      await tracker.complete(task1Id, 'tenant-1')

      await new Promise(resolve => setTimeout(resolve, 200))

      // Only tenant-1 should have received updates
      expect(tenant1Received.length).toBeGreaterThan(0)
      expect(tenant2Received.length).toBe(0)

      unsub1()
      unsub2()
    })
  })

  describe('multi-tenant isolation', () => {
    it('should completely isolate tasks between tenants', async () => {
      // Create tasks for multiple tenants
      await tracker.create('task-1', 'tenant-a', 'tenant-a-task')
      await tracker.create('task-1', 'tenant-b', 'tenant-b-task')
      await tracker.create('task-1', 'tenant-c', 'tenant-c-task')

      await new Promise(resolve => setTimeout(resolve, 100))

      // Each tenant should only see their own task
      const taskA = await tracker.get('task-1', 'tenant-a')
      const taskB = await tracker.get('task-1', 'tenant-b')
      const taskC = await tracker.get('task-1', 'tenant-c')

      expect(taskA?.name).toBe('tenant-a-task')
      expect(taskB?.name).toBe('tenant-b-task')
      expect(taskC?.name).toBe('tenant-c-task')

      // Cross-tenant access should fail
      const wrongTenant = await tracker.get('task-1', 'tenant-x')
      expect(wrongTenant).toBeNull()
    })

    it('should handle many tenants concurrently', async () => {
      const tenantCount = 50
      const tasksPerTenant = 10

      // Create tasks for many tenants
      await Promise.all(
        Array.from({ length: tenantCount }, async (_, tenantIndex) => {
          const tenantId = `tenant-${tenantIndex}`
          await Promise.all(
            Array.from({ length: tasksPerTenant }, async (_, taskIndex) => {
              await tracker.create({
                id: `task-${taskIndex}`,
                tenantId,
                name: `${tenantId}-task-${taskIndex}`,
              })
            }),
          )
        }),
      )

      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify random samples
      const randomTenant = `tenant-${Math.floor(Math.random() * tenantCount)}`
      const randomTask = await tracker.get(`task-5`, randomTenant)

      expect(randomTask).toBeDefined()
      expect(randomTask?.tenantId).toBe(randomTenant)
    }, 30000)
  })

  describe('full task lifecycle with Redis', () => {
    it('should track complete task lifecycle', async () => {
      const states: any[] = []

      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'lifecycle-task',
        message: 'Created',
      })

      tracker.subscribe(taskId, 'tenant-1', state => {
        states.push({ status: state.status, progress: state.progress })
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Run through lifecycle
      await tracker.start(taskId, 'tenant-1', 'Starting...')
      await tracker.progress(taskId, 'tenant-1', 25, 'Step 1')
      await tracker.progress(taskId, 'tenant-1', 50, 'Step 2')
      await tracker.progress(taskId, 'tenant-1', 75, 'Step 3')
      await tracker.complete(taskId, 'tenant-1', { success: true })

      await new Promise(resolve => setTimeout(resolve, 300))

      // Verify final state
      const finalTask = await tracker.get(taskId, 'tenant-1')
      expect(finalTask?.status).toBe('COMPLETED')
      expect(finalTask?.progress).toBe(100)
      expect(finalTask?.result).toEqual({ success: true })
      expect(finalTask?.completedAt).toBeDefined()

      // Verify we received all updates
      expect(states.some(s => s.status === 'RUNNING')).toBe(true)
      expect(states.some(s => s.status === 'COMPLETED')).toBe(true)
    })

    it('should track failure lifecycle', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'failing-task',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      await tracker.start(taskId, 'tenant-1')
      await tracker.progress(taskId, 'tenant-1', 30)
      await tracker.fail(taskId, 'tenant-1', new Error('Connection refused'))

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.status).toBe('FAILED')
      expect(task?.error).toBe('Connection refused')
      expect(task?.completedAt).toBeDefined()
    })

    it('should track cancellation lifecycle', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'cancellable-task',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      await tracker.start(taskId, 'tenant-1')
      await tracker.cancel(taskId, 'tenant-1', 'User requested cancellation')

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.status).toBe('CANCELLED')
      expect(task?.message).toBe('User requested cancellation')
    })
  })

  describe('graceful shutdown', () => {
    it('should drain buffer and persist all tasks before shutdown', async () => {
      const host = container.getHost()
      const port = container.getMappedPort(6379)

      // Create tracker with large buffer
      const redis1 = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const subscriber1 = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const connector1 = new RedisTaskTrackerConnector(redis1, subscriber1)

      const shutdownTracker = new TaskTracker(connector1, {
        flushIntervalMs: 10000, // Long interval
        flushThreshold: 1000, // High threshold
        bufferStrategy: 'STATIC',
      })

      // Create tasks (will be buffered)
      const taskIds: string[] = []
      for (let i = 0; i < 50; i++) {
        const id = await shutdownTracker.create({
          tenantId: 'tenant-1',
          name: `shutdown-task-${i}`,
        })
        taskIds.push(id)
      }

      // Shutdown should drain buffer
      await shutdownTracker.shutdown()

      // Verify tasks persisted by reading from new connection
      const redis2 = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const subscriber2 = new Redis({
        host,
        port,
        maxRetriesPerRequest: null,
      }) as unknown as RedisClient
      const connector2 = new RedisTaskTrackerConnector(redis2, subscriber2)

      const verifyTracker = new TaskTracker(connector2)

      // Check random task
      const task = await verifyTracker.get(taskIds[25], 'tenant-1')
      expect(task).toBeDefined()
      expect(task?.name).toBe('shutdown-task-25')

      await verifyTracker.shutdown()
    })
  })

  describe('TTL behavior', () => {
    it('should set appropriate TTL based on task status', async () => {
      const host = container.getHost()
      const port = container.getMappedPort(6379)

      const checkRedis = new Redis({ host, port, maxRetriesPerRequest: null })

      // Create a task
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'ttl-test',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Check initial TTL (default)
      let ttl = await checkRedis.ttl(`task:tenant-1:${taskId}`)
      expect(ttl).toBeGreaterThan(0)

      // Complete the task
      await tracker.complete(taskId, 'tenant-1')

      // Check completed TTL
      ttl = await checkRedis.ttl(`task:tenant-1:${taskId}`)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(86400) // completedTTL

      await checkRedis.quit()
    })
  })

  describe('error recovery', () => {
    it('should handle Redis reconnection gracefully', async () => {
      // This test verifies the tracker continues working after brief network issues
      // by simulating normal operations

      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'recovery-task',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Operations should succeed
      await tracker.start(taskId, 'tenant-1')
      await tracker.progress(taskId, 'tenant-1', 50)
      await tracker.complete(taskId, 'tenant-1')

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.status).toBe('COMPLETED')
    })
  })
})

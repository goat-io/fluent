import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackedTaskState } from '../tracker.types'
import { InMemoryTaskTrackerConnector } from './InMemoryConnector'

describe('InMemoryTaskTrackerConnector', () => {
  let connector: InMemoryTaskTrackerConnector

  beforeEach(() => {
    connector = new InMemoryTaskTrackerConnector()
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
    it('should create multiple tasks in batch', async () => {
      const tasks = [
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-1'),
        createTaskState('task-3', 'tenant-2'),
      ]

      await connector.createBatch(tasks)

      expect(connector.size).toBe(3)

      const task1 = await connector.get('task-1', 'tenant-1')
      const task2 = await connector.get('task-2', 'tenant-1')
      const task3 = await connector.get('task-3', 'tenant-2')

      expect(task1).toBeDefined()
      expect(task1?.id).toBe('task-1')
      expect(task2?.id).toBe('task-2')
      expect(task3?.id).toBe('task-3')
      expect(task3?.tenantId).toBe('tenant-2')
    })

    it('should handle empty batch', async () => {
      await connector.createBatch([])
      expect(connector.size).toBe(0)
    })

    it('should store task properties correctly', async () => {
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

    it('should create task if not exists on update', async () => {
      await connector.update('task-1', 'tenant-1', {
        status: 'RUNNING',
        progress: 50,
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task).toBeDefined()
      expect(task?.status).toBe('RUNNING')
      expect(task?.progress).toBe(50)
    })

    it('should update timestamp on update', async () => {
      const initialTime = Date.now()
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { updatedAt: initialTime }),
      ])

      // Wait a tiny bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      await connector.update('task-1', 'tenant-1', { progress: 50 })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.updatedAt).toBeGreaterThanOrEqual(initialTime)
    })

    it('should update result correctly', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', {
        status: 'COMPLETED',
        progress: 100,
        result: { orderId: 'order-123', items: [1, 2, 3] },
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.result).toEqual({ orderId: 'order-123', items: [1, 2, 3] })
    })

    it('should update error correctly', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', {
        status: 'FAILED',
        error: 'Connection timeout',
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.status).toBe('FAILED')
      expect(task?.error).toBe('Connection timeout')
    })

    it('should update completedAt correctly', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      const completedAt = Date.now()
      await connector.update('task-1', 'tenant-1', {
        status: 'COMPLETED',
        completedAt,
      })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.completedAt).toBe(completedAt)
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

    it('should return a copy of task state', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      const task1 = await connector.get('task-1', 'tenant-1')
      const task2 = await connector.get('task-1', 'tenant-1')

      // Should be equal but not the same reference
      expect(task1).toEqual(task2)
      expect(task1).not.toBe(task2)
    })
  })

  describe('publish and subscribe', () => {
    it('should publish updates to subscribers', async () => {
      const callback = vi.fn()
      connector.subscribe('tenant-1', 'task-1', callback)

      const state = createTaskState('task-1', 'tenant-1', {
        status: 'RUNNING',
        progress: 50,
      })

      await connector.publish('tenant-1', 'task-1', state)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-1',
          status: 'RUNNING',
          progress: 50,
        }),
      )
    })

    it('should support multiple subscribers', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      connector.subscribe('tenant-1', 'task-1', callback1)
      connector.subscribe('tenant-1', 'task-1', callback2)

      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should not notify unsubscribed callbacks', async () => {
      const callback = vi.fn()
      const unsubscribe = connector.subscribe('tenant-1', 'task-1', callback)

      unsubscribe()

      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )

      expect(callback).not.toHaveBeenCalled()
    })

    it('should isolate subscriptions by tenant', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      connector.subscribe('tenant-1', 'task-1', callback1)
      connector.subscribe('tenant-2', 'task-1', callback2)

      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).not.toHaveBeenCalled()
    })

    it('should isolate subscriptions by task', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      connector.subscribe('tenant-1', 'task-1', callback1)
      connector.subscribe('tenant-1', 'task-2', callback2)

      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).not.toHaveBeenCalled()
    })

    it('should return unsubscribe function', async () => {
      const callback = vi.fn()
      const unsubscribe = connector.subscribe('tenant-1', 'task-1', callback)

      expect(typeof unsubscribe).toBe('function')

      // First publish should work
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      expect(callback).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsubscribe()

      // Second publish should not trigger callback
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should clean up old tasks for tenant', async () => {
      const oldTime = Date.now() - 60000 // 1 minute ago
      const recentTime = Date.now()

      await connector.createBatch([
        createTaskState('old-task', 'tenant-1', { createdAt: oldTime }),
        createTaskState('recent-task', 'tenant-1', { createdAt: recentTime }),
      ])

      const cleaned = await connector.cleanup('tenant-1', 30000) // Clean older than 30 seconds

      expect(cleaned).toBe(1)
      expect(await connector.get('old-task', 'tenant-1')).toBeNull()
      expect(await connector.get('recent-task', 'tenant-1')).not.toBeNull()
    })

    it('should only clean tasks for specified tenant', async () => {
      const oldTime = Date.now() - 60000

      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { createdAt: oldTime }),
        createTaskState('task-2', 'tenant-2', { createdAt: oldTime }),
      ])

      await connector.cleanup('tenant-1', 30000)

      expect(await connector.get('task-1', 'tenant-1')).toBeNull()
      expect(await connector.get('task-2', 'tenant-2')).not.toBeNull()
    })

    it('should return count of cleaned tasks', async () => {
      const oldTime = Date.now() - 60000

      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { createdAt: oldTime }),
        createTaskState('task-2', 'tenant-1', { createdAt: oldTime }),
        createTaskState('task-3', 'tenant-1', { createdAt: oldTime }),
      ])

      const cleaned = await connector.cleanup('tenant-1', 30000)
      expect(cleaned).toBe(3)
    })
  })

  describe('close', () => {
    it('should NOT clear tasks on close (allows inspection in tests)', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-2'),
      ])

      await connector.close()

      // Tasks remain for inspection after close
      expect(connector.size).toBe(2)

      // Use clear() explicitly to remove tasks
      connector.clear()
      expect(connector.size).toBe(0)
    })

    it('should remove all event listeners on close', async () => {
      const callback = vi.fn()
      connector.subscribe('tenant-1', 'task-1', callback)

      await connector.close()

      // Publishing after close should not trigger callback
      await connector.publish(
        'tenant-1',
        'task-1',
        createTaskState('task-1', 'tenant-1'),
      )
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('test helpers', () => {
    it('getAllTasks should return all tasks', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-1'),
        createTaskState('task-3', 'tenant-2'),
      ])

      const allTasks = connector.getAllTasks()
      expect(allTasks.length).toBe(3)
    })

    it('getAllTasks should filter by tenant', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-1'),
        createTaskState('task-3', 'tenant-2'),
      ])

      const tenant1Tasks = connector.getAllTasks('tenant-1')
      expect(tenant1Tasks.length).toBe(2)
      expect(tenant1Tasks.every(t => t.tenantId === 'tenant-1')).toBe(true)
    })

    it('clear should remove all tasks', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-2'),
      ])

      connector.clear()

      expect(connector.size).toBe(0)
    })

    it('size should return correct count', async () => {
      expect(connector.size).toBe(0)

      await connector.createBatch([
        createTaskState('task-1', 'tenant-1'),
        createTaskState('task-2', 'tenant-1'),
      ])

      expect(connector.size).toBe(2)
    })
  })

  describe('multi-tenant isolation', () => {
    it('should isolate tasks by tenant', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { name: 'tenant-1-task' }),
        createTaskState('task-1', 'tenant-2', { name: 'tenant-2-task' }),
      ])

      const tenant1Task = await connector.get('task-1', 'tenant-1')
      const tenant2Task = await connector.get('task-1', 'tenant-2')

      expect(tenant1Task?.name).toBe('tenant-1-task')
      expect(tenant2Task?.name).toBe('tenant-2-task')
    })

    it('should not allow cross-tenant access', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      // Same task ID, different tenant should be null
      const crossTenantTask = await connector.get('task-1', 'tenant-2')
      expect(crossTenantTask).toBeNull()
    })

    it('should update only the correct tenant task', async () => {
      await connector.createBatch([
        createTaskState('task-1', 'tenant-1', { progress: 0 }),
        createTaskState('task-1', 'tenant-2', { progress: 0 }),
      ])

      await connector.update('task-1', 'tenant-1', { progress: 100 })

      const tenant1Task = await connector.get('task-1', 'tenant-1')
      const tenant2Task = await connector.get('task-1', 'tenant-2')

      expect(tenant1Task?.progress).toBe(100)
      expect(tenant2Task?.progress).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in IDs', async () => {
      const task = createTaskState('task:with:colons', 'tenant/with/slashes')
      await connector.createBatch([task])

      const retrieved = await connector.get(
        'task:with:colons',
        'tenant/with/slashes',
      )
      expect(retrieved?.id).toBe('task:with:colons')
      expect(retrieved?.tenantId).toBe('tenant/with/slashes')
    })

    it('should handle very long task names', async () => {
      const longName = 'a'.repeat(1000)
      const task = createTaskState('task-1', 'tenant-1', { name: longName })
      await connector.createBatch([task])

      const retrieved = await connector.get('task-1', 'tenant-1')
      expect(retrieved?.name).toBe(longName)
    })

    it('should handle null and undefined in result', async () => {
      await connector.createBatch([createTaskState('task-1', 'tenant-1')])

      await connector.update('task-1', 'tenant-1', { result: null })
      let task = await connector.get('task-1', 'tenant-1')
      expect(task?.result).toBeNull()

      await connector.update('task-1', 'tenant-1', { result: undefined })
      task = await connector.get('task-1', 'tenant-1')
      expect(task?.result).toBeUndefined()
    })

    it('should handle complex nested result objects', async () => {
      const complexResult = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, { nested: 'value' }],
              boolean: true,
              number: 42.5,
              string: 'test',
            },
          },
        },
      }

      await connector.createBatch([createTaskState('task-1', 'tenant-1')])
      await connector.update('task-1', 'tenant-1', { result: complexResult })

      const task = await connector.get('task-1', 'tenant-1')
      expect(task?.result).toEqual(complexResult)
    })
  })
})

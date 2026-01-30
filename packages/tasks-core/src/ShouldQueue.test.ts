import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShouldQueue } from './ShouldQueue'
import type { TaskConnector } from './ShouldQueue.types'
import { InMemoryTaskTrackerConnector } from './tracker/connectors/InMemoryConnector'
import { TaskTracker } from './tracker/TaskTracker'

// Mock task connector
const createMockConnector = (
  tenantId?: string,
): TaskConnector<{ text: string }> => ({
  tenantId,
  queue: vi.fn().mockResolvedValue({
    id: 'mock-task-id',
    name: 'test-task',
    status: 'QUEUED',
    output: '',
    attempts: 0,
    created: new Date().toISOString(),
    nextRun: null,
    nextRunMinutes: null,
  }),
  getStatus: vi.fn().mockResolvedValue({
    id: 'mock-task-id',
    name: 'test-task',
    status: 'COMPLETED',
    output: '',
    attempts: 1,
    created: new Date().toISOString(),
    nextRun: null,
    nextRunMinutes: null,
    payload: { text: 'test' },
  }),
})

// Test task implementation
class TestTask extends ShouldQueue<{ text: string }, { result: string }> {
  taskName = 'test-task'
  postUrl = '/api/test'

  async handle(taskBody: { text: string }): Promise<{ result: string }> {
    return { result: `processed: ${taskBody.text}` }
  }
}

// Test task with progress
class ProgressTask extends ShouldQueue<{ text: string }, { result: string }> {
  taskName = 'progress-task'
  postUrl = '/api/progress'

  async handle(taskBody: { text: string }): Promise<{ result: string }> {
    await this.progress(25, 'Starting...')
    await this.progress(50, 'Processing...')
    await this.progress(75, 'Finishing...')
    return { result: `done: ${taskBody.text}` }
  }
}

// Test task that fails
class FailingTask extends ShouldQueue<{ text: string }> {
  taskName = 'failing-task'
  postUrl = '/api/failing'

  async handle(_taskBody: { text: string }): Promise<undefined> {
    throw new Error('Task failed intentionally')
  }
}

describe('ShouldQueue', () => {
  describe('basic functionality (without tracker)', () => {
    let connector: TaskConnector<{ text: string }>
    let task: TestTask

    beforeEach(() => {
      connector = createMockConnector()
      task = new TestTask({ connector })
    })

    it('should queue a task', async () => {
      const status = await task.queue({ text: 'hello' })

      expect(connector.queue).toHaveBeenCalled()
      expect(status).toHaveProperty('id')
      expect(status).toHaveProperty('status', 'QUEUED')
    })

    it('should get task status', async () => {
      const status = await task.getStatus('mock-task-id')

      expect(connector.getStatus).toHaveBeenCalledWith('mock-task-id')
      expect(status).toHaveProperty('payload')
    })

    it('should use basePostUrl if provided', async () => {
      task = new TestTask({
        connector,
        basePostUrl: 'https://api.example.com',
      })

      await task.queue({ text: 'test' })

      expect(connector.queue).toHaveBeenCalledWith(
        expect.objectContaining({
          postUrl: 'https://api.example.com/api/test',
        }),
      )
    })

    it('should call handle when executed', async () => {
      const handleSpy = vi.spyOn(task, 'handle')
      const _queueCall = (connector.queue as any).mock.calls[0]

      await task.queue({ text: 'test' })

      // Get the handle function passed to queue
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle
      const _result = await passedHandle()

      expect(handleSpy).toHaveBeenCalled()
    })

    it('should return correct unique task name', () => {
      const uniqueName = task.getUniqueTaskName({ text: 'test' })
      expect(uniqueName).toBe('test-task')
    })

    it('should return undefined for progress() without tracker', async () => {
      // Progress should be a no-op without tracker
      await expect(task.progress(50, 'test')).resolves.toBeUndefined()
    })

    it('should return undefined for subscribe() without tracker', () => {
      const result = task.subscribe('task-id', () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('with TaskTracker integration', () => {
    let connector: TaskConnector<{ text: string }>
    let trackerConnector: InMemoryTaskTrackerConnector
    let tracker: TaskTracker
    let task: TestTask

    beforeEach(() => {
      connector = createMockConnector('test-tenant')

      trackerConnector = new InMemoryTaskTrackerConnector()
      tracker = new TaskTracker(trackerConnector, {
        flushIntervalMs: 5,
        flushThreshold: 10,
        bufferStrategy: 'STATIC',
      })

      task = new TestTask({
        connector,
        tracker,
      })
    })

    afterEach(async () => {
      await tracker.shutdown()
    })

    it('should create tracked task on queue', async () => {
      const status = await task.queue({ text: 'tracked' })

      expect(status.id).toBeDefined()

      // Wait for buffer to flush
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify tracked task was created
      const tasks = trackerConnector.getAllTasks('test-tenant')
      expect(tasks.length).toBe(1)
      expect(tasks[0].name).toBe('test-task')
      expect(tasks[0].status).toBe('QUEUED')
    })

    it('should track task lifecycle through handle execution', async () => {
      await task.queue({ text: 'lifecycle' })
      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the handle function and execute it
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle
      const result = await passedHandle()

      expect(result).toEqual({ result: 'processed: lifecycle' })

      // Check final state
      const tasks = trackerConnector.getAllTasks('test-tenant')
      expect(tasks[0].status).toBe('COMPLETED')
      expect(tasks[0].result).toEqual({ result: 'processed: lifecycle' })
    })

    it('should track failure on handle error', async () => {
      const failingTask = new FailingTask({
        connector,
        tracker,
      })

      await failingTask.queue({ text: 'will-fail' })
      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the handle function and execute it
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle

      await expect(passedHandle()).rejects.toThrow('Task failed intentionally')

      // Check failure was tracked
      const tasks = trackerConnector.getAllTasks('test-tenant')
      expect(tasks[0].status).toBe('FAILED')
      expect(tasks[0].error).toBe('Task failed intentionally')
    })

    it('should support progress updates during handle', async () => {
      const progressTask = new ProgressTask({
        connector,
        tracker,
      })

      await progressTask.queue({ text: 'progress-test' })
      await new Promise(resolve => setTimeout(resolve, 50))

      // Get the handle function and execute it
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle
      await passedHandle()

      // Check task completed with progress
      const tasks = trackerConnector.getAllTasks('test-tenant')
      expect(tasks[0].status).toBe('COMPLETED')
    })

    it('should return tracker ID in queue response', async () => {
      const status = await task.queue({ text: 'get-id' })

      expect(status.id).toBeDefined()
      expect(typeof status.id).toBe('string')
    })

    it('should get status from tracker when available', async () => {
      const queueResult = await task.queue({ text: 'status-test' })
      await new Promise(resolve => setTimeout(resolve, 50))

      // Execute the task
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle
      await passedHandle()

      // Get status should use tracker
      const status = await task.getStatus(queueResult.id)
      expect(status.status).toBe('COMPLETED')
    })

    it('should support subscribe with tracker', async () => {
      const received: any[] = []

      const queueResult = await task.queue({ text: 'subscribe-test' })

      const unsubscribe = task.subscribe(queueResult.id, state => {
        received.push(state)
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Execute the task to trigger updates
      const passedHandle = (connector.queue as any).mock.calls[0][0].handle
      await passedHandle()

      expect(unsubscribe).toBeDefined()
      expect(typeof unsubscribe).toBe('function')

      // At minimum we should receive completion
      expect(received.length).toBeGreaterThan(0)

      unsubscribe!()
    })

    it('should not track when tenantId is not set', async () => {
      const noTenantConnector = createMockConnector() // no tenantId

      const noTenantTask = new TestTask({
        connector: noTenantConnector,
        tracker,
      })

      const status = await noTenantTask.queue({ text: 'no-tenant' })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Should not create tracked task
      const tasks = trackerConnector.getAllTasks()
      expect(tasks.length).toBe(0)

      // Should still return mock connector's ID
      expect(status.id).toBe('mock-task-id')
    })
  })

  describe('forTenant', () => {
    it('should create tenant-scoped task', () => {
      const connector = createMockConnector()
      connector.forTenant = vi.fn().mockImplementation(tenantId => ({
        ...connector,
        tenantId,
      }))

      const task = new TestTask({ connector })

      const tenantTask = task.forTenant('tenant-123')

      expect(tenantTask).toBeDefined()
      expect(connector.forTenant).toHaveBeenCalledWith('tenant-123', undefined)
    })

    it('should return undefined if connector does not support tenants', () => {
      const connector = createMockConnector()
      // No forTenant method

      const task = new TestTask({ connector })

      const tenantTask = task.forTenant('tenant-123')

      expect(tenantTask).toBeUndefined()
    })

    it('should pass tracker to tenant-scoped task', async () => {
      const trackerConnector = new InMemoryTaskTrackerConnector()
      const tracker = new TaskTracker(trackerConnector, {
        flushIntervalMs: 5,
        bufferStrategy: 'STATIC',
      })

      const connector = createMockConnector()
      connector.forTenant = vi.fn().mockImplementation(tenantId => ({
        ...connector,
        tenantId,
      }))

      const task = new TestTask({ connector, tracker })

      const tenantTask = task.forTenant('tenant-456')

      expect(tenantTask?.tracker).toBe(tracker)

      await tracker.shutdown()
    })

    it('should pass credentials to forTenant', () => {
      const connector = createMockConnector()
      connector.forTenant = vi
        .fn()
        .mockImplementation((tenantId, _credentials) => ({
          ...connector,
          tenantId,
        }))

      const task = new TestTask({ connector })

      task.forTenant('tenant-123', {
        username: 'user',
        password: 'secret',
      })

      expect(connector.forTenant).toHaveBeenCalledWith('tenant-123', {
        username: 'user',
        password: 'secret',
      })
    })
  })

  describe('tenantId getter', () => {
    it('should return tenantId from connector', () => {
      const connector = createMockConnector('my-tenant')

      const task = new TestTask({ connector })

      expect(task.tenantId).toBe('my-tenant')
    })

    it('should return undefined when connector has no tenantId', () => {
      const connector = createMockConnector()

      const task = new TestTask({ connector })

      expect(task.tenantId).toBeUndefined()
    })
  })
})

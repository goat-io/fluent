// pnpm exec vitest run src/tracker/TaskTracker.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestBuffer } from './buffer/IngestBuffer'
import { InMemoryTaskTrackerConnector } from './connectors/InMemoryConnector'
import { TaskTracker } from './TaskTracker'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function observe<T>(promise: Promise<T>) {
  let settled = false
  const result = promise.then(
    value => {
      settled = true
      return { ok: true as const, value }
    },
    error => {
      settled = true
      return { ok: false as const, error }
    },
  )
  return { result, settled: () => settled }
}

describe('TaskTracker accepted creation ownership', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  function fixture(threshold = 10) {
    const connector = new InMemoryTaskTrackerConnector()
    const tracker = new TaskTracker(connector, {
      flushThreshold: threshold,
      flushIntervalMs: 1,
      bufferStrategy: 'STATIC',
    })
    return { connector, tracker }
  }
  it.each([new Error('early drain failure'), undefined])(
    'rejects pending creation waiters if drain fails before processing: %s',
    async error => {
      const { connector, tracker } = fixture()
      await tracker.create('task', 'tenant', 'example')
      const update = vi.spyOn(connector, 'update')
      const close = vi.spyOn(connector, 'close')
      const mutation = observe(tracker.complete('task', 'tenant'))
      vi.spyOn(IngestBuffer.prototype, 'drain').mockImplementationOnce(() => {
        throw error
      })
      const stop = observe(tracker.shutdown())
      await vi.advanceTimersByTimeAsync(0)
      const settledWithoutAnotherFlush = stop.settled()
      // Release the old implementation's waiter so RED has no leaked promise.
      await vi.advanceTimersByTimeAsync(1)
      const mutationResult = await mutation.result
      expect(await stop.result).toEqual({ ok: false, error })
      expect(settledWithoutAnotherFlush).toBe(true)
      expect(mutationResult).toEqual({ ok: false, error })
      expect(update).not.toHaveBeenCalled()
      expect(close).not.toHaveBeenCalled()
    },
  )
  it.each(['start', 'progress', 'complete', 'fail', 'cancel'] as const)(
    'waits for accepted create before %s and cannot be overwritten by late persistence',
    async method => {
      const { connector, tracker } = fixture()
      const held = deferred()
      const original = connector.createBatch.bind(connector)
      vi.spyOn(connector, 'createBatch').mockImplementation(async states => {
        await held.promise
        await original(states)
      })
      const update = vi.spyOn(connector, 'update')
      await tracker.create('task', 'tenant', 'example')
      await vi.advanceTimersByTimeAsync(1)
      const operation = observe(
        method === 'progress'
          ? tracker.progress('task', 'tenant', { progress: 50 })
          : method === 'fail'
            ? tracker.fail('task', 'tenant', 'failure')
            : tracker[method]('task', 'tenant'),
      )
      await vi.advanceTimersByTimeAsync(0)
      const premature = operation.settled()
      const earlyUpdates = update.mock.calls.length
      held.resolve()
      await operation.result
      await vi.advanceTimersByTimeAsync(20)
      await tracker.shutdown()
      expect(premature).toBe(false)
      expect(earlyUpdates).toBe(0)
      const state = await connector.get('task', 'tenant')
      expect(method === 'progress' ? state?.progress : state?.status).toBe(
        {
          start: 'RUNNING',
          progress: 50,
          complete: 'COMPLETED',
          fail: 'FAILED',
          cancel: 'CANCELLED',
        }[method],
      )
    },
  )
  it('joins every duplicate-ID receipt while unrelated tenants and IDs proceed', async () => {
    const { connector, tracker } = fixture(1)
    const first = deferred()
    const second = deferred()
    const original = connector.createBatch.bind(connector)
    vi.spyOn(connector, 'createBatch')
      .mockImplementationOnce(async states => {
        await first.promise
        await original(states)
      })
      .mockImplementationOnce(async states => {
        await second.promise
        await original(states)
      })
    const a = tracker.create('same', 'tenant', 'first')
    const b = tracker.create('same', 'tenant', 'second')
    const operation = observe(tracker.complete('same', 'tenant'))
    await tracker.create('other', 'tenant', 'other')
    await tracker.complete('other', 'tenant')
    await tracker.create('same', 'other-tenant', 'other')
    await tracker.complete('same', 'other-tenant')
    second.resolve()
    await b
    await vi.advanceTimersByTimeAsync(0)
    const premature = operation.settled()
    first.resolve()
    await a
    await operation.result
    await tracker.shutdown()
    expect(premature).toBe(false)
    expect((await connector.get('same', 'tenant'))?.status).toBe('COMPLETED')
    expect((await connector.get('other', 'tenant'))?.status).toBe('COMPLETED')
    expect((await connector.get('same', 'other-tenant'))?.status).toBe(
      'COMPLETED',
    )
  })
  it.each([new Error('persistence failed'), undefined])(
    'rejects failed receipts, but successful automatic retry permits future calls: %s',
    async error => {
      const { connector, tracker } = fixture(1)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(connector, 'createBatch').mockRejectedValueOnce(error)
      const update = vi.spyOn(connector, 'update')
      await tracker.create('task', 'tenant', 'example')
      const failed = await observe(tracker.start('task', 'tenant')).result
      const earlyUpdates = update.mock.calls.length
      await tracker.create('retry-trigger', 'tenant', 'retry')
      await tracker.complete('task', 'tenant')
      await tracker.shutdown()
      expect(failed).toEqual({ ok: false, error })
      expect(earlyUpdates).toBe(0)
      expect((await connector.get('task', 'tenant'))?.status).toBe('COMPLETED')
    },
  )
  it('owns a create initial publish and a mutation publish through shared shutdown', async () => {
    const { connector, tracker } = fixture(1)
    const held = deferred()
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    const close = vi.spyOn(connector, 'close')
    const creation = tracker.create('task', 'tenant', 'example')
    const mutation = tracker.complete('task', 'tenant')
    const stopping = tracker.shutdown()
    const same = tracker.shutdown()
    const watched = observe(stopping)
    await vi.advanceTimersByTimeAsync(20)
    const earlyClose = close.mock.calls.length
    const premature = watched.settled()
    held.resolve()
    await Promise.all([creation, mutation, stopping])
    expect(same).toBe(stopping)
    expect(premature).toBe(false)
    expect(earlyClose).toBe(0)
    expect(close).toHaveBeenCalledOnce()
  })
  it('registers create before input getter reenters shutdown', async () => {
    const { connector, tracker } = fixture()
    const held = deferred()
    let reentrant: Promise<void> | undefined
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    const close = vi.spyOn(connector, 'close')
    const creation = observe(
      tracker.create({
        get id(): string {
          reentrant = tracker.shutdown()
          return 'task'
        },
        tenantId: 'tenant',
        name: 'example',
      }),
    )
    const stopping = tracker.shutdown()
    await vi.advanceTimersByTimeAsync(20)
    const earlyClose = close.mock.calls.length
    held.resolve()
    const created = await creation.result
    await stopping
    expect(created.ok).toBe(true)
    expect(reentrant).toBe(stopping)
    expect(earlyClose).toBe(0)
    expect((await connector.get('task', 'tenant'))?.name).toBe('example')
  })
  it('retains resources on drain failure and joins an accepted held publish', async () => {
    const { connector, tracker } = fixture()
    const error = new Error('drain failure')
    const held = deferred()
    vi.spyOn(connector, 'createBatch').mockRejectedValue(error)
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    const close = vi.spyOn(connector, 'close')
    const creation = tracker.create('task', 'tenant', 'example')
    const mutation = observe(tracker.complete('task', 'tenant'))
    const stopping = observe(tracker.shutdown())
    await vi.advanceTimersByTimeAsync(0)
    const premature = stopping.settled()
    held.resolve()
    await creation
    expect(await mutation.result).toEqual({ ok: false, error })
    expect(await stopping.result).toEqual({ ok: false, error })
    expect(premature).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })
  it('preserves the first observed duplicate receipt failure including undefined and joins the held sibling', async () => {
    const { connector, tracker } = fixture(1)
    const first = deferred()
    const second = deferred()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(connector, 'createBatch')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const update = vi.spyOn(connector, 'update')
    const a = tracker.create('task', 'tenant', 'first')
    const b = tracker.create('task', 'tenant', 'second')
    const waiting = observe(tracker.complete('task', 'tenant'))
    second.reject(undefined)
    await b
    await vi.advanceTimersByTimeAsync(0)
    const premature = waiting.settled()
    first.reject(new Error('later'))
    await a
    expect(await waiting.result).toEqual({ ok: false, error: undefined })
    expect(premature).toBe(false)
    expect(update).not.toHaveBeenCalled()
    // Existing buffer retry on drain persists the same objects, not new jobs.
    await tracker.shutdown()
  })
  it('owns a throwing input getter and held sibling publish through failed shutdown', async () => {
    const { connector, tracker } = fixture(1)
    const held = deferred()
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    const close = vi.spyOn(connector, 'close')
    const sibling = tracker.create('sibling', 'tenant', 'example')
    let reentrant: Promise<void> | undefined
    const error = new Error('getter')
    const creation = observe(
      tracker.create({
        get id(): string {
          reentrant = tracker.shutdown()
          throw error
        },
        tenantId: 'tenant',
        name: 'example',
      }),
    )
    const stopping = observe(tracker.shutdown())
    await vi.advanceTimersByTimeAsync(20)
    const premature = stopping.settled()
    held.resolve()
    await sibling
    expect(await creation.result).toEqual({ ok: false, error })
    expect(await stopping.result).toEqual({ ok: false, error })
    expect(reentrant).toBe(tracker.shutdown())
    expect(premature).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })
  it('captures synchronous createBatch failure before reentrant mutation and permits a later successful retry', async () => {
    const { connector, tracker } = fixture(1)
    const error = new Error('sync batch')
    let reentrant: ReturnType<typeof observe<void>> | undefined
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(connector, 'createBatch').mockImplementationOnce(() => {
      reentrant = observe(tracker.start('task', 'tenant'))
      throw error
    })
    const update = vi.spyOn(connector, 'update')
    await tracker.create('task', 'tenant', 'example')
    expect(await reentrant?.result).toEqual({ ok: false, error })
    expect(update).not.toHaveBeenCalled()
    await tracker.create('retry', 'tenant', 'retry')
    await tracker.start('task', 'tenant')
    await tracker.shutdown()
  })
  it('joins held mutation publication even when another accepted mutation fails synchronously', async () => {
    const { connector, tracker } = fixture(1)
    await tracker.create('a', 'tenant', 'a')
    await tracker.create('b', 'tenant', 'b')
    const held = deferred()
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    vi.spyOn(connector, 'update').mockImplementationOnce(() => {
      throw undefined
    })
    const close = vi.spyOn(connector, 'close')
    const failed = observe(tracker.complete('a', 'tenant'))
    const sibling = tracker.complete('b', 'tenant')
    const stopping = observe(tracker.shutdown())
    await vi.advanceTimersByTimeAsync(0)
    const premature = stopping.settled()
    held.resolve()
    await sibling
    expect(await failed.result).toEqual({ ok: false, error: undefined })
    expect(await stopping.result).toEqual({ ok: false, error: undefined })
    expect(premature).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })
  it('fences later creates before getters and preserves later mutation no-ops', async () => {
    const { connector, tracker } = fixture()
    await tracker.shutdown()
    const getter = vi.fn(() => 'task')
    const update = vi.spyOn(connector, 'update')
    await expect(
      tracker.create({
        get id() {
          return getter()
        },
        tenantId: 'tenant',
        name: 'example',
      }),
    ).rejects.toThrow('shutdown')
    await tracker.progress('task', 'tenant', {
      get progress(): number {
        throw new Error('must not read')
      },
    })
    expect(getter).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
  it('retains resources and memoizes shutdown when an accepted create publication rejects with undefined', async () => {
    const { connector, tracker } = fixture(1)
    const held = deferred()
    vi.spyOn(connector, 'publish').mockImplementation(() => held.promise)
    const close = vi.spyOn(connector, 'close')
    const creation = observe(tracker.create('task', 'tenant', 'example'))
    const stop = tracker.shutdown()
    const stopping = observe(stop)
    await vi.advanceTimersByTimeAsync(20)
    expect(stopping.settled()).toBe(false)
    held.reject(undefined)
    expect(await creation.result).toEqual({ ok: false, error: undefined })
    expect(await stopping.result).toEqual({ ok: false, error: undefined })
    expect(tracker.shutdown()).toBe(stop)
    expect(close).not.toHaveBeenCalled()
  })
})

describe('TaskTracker', () => {
  let connector: InMemoryTaskTrackerConnector
  let tracker: TaskTracker

  beforeEach(() => {
    connector = new InMemoryTaskTrackerConnector()
    tracker = new TaskTracker(connector, {
      flushIntervalMs: 10,
      flushThreshold: 5,
      bufferStrategy: 'STATIC',
    })
  })

  afterEach(async () => {
    if (!tracker.isShutdown) {
      await tracker.shutdown()
    }
  })

  describe('create', () => {
    it('should create a task with options object', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'test-task',
        message: 'Starting...',
      })

      expect(taskId).toBeDefined()
      expect(typeof taskId).toBe('string')

      // Wait for buffer to flush
      await new Promise(resolve => setTimeout(resolve, 50))

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.name).toBe('test-task')
      expect(task?.status).toBe('QUEUED')
      expect(task?.message).toBe('Starting...')
    })

    it('should create a task with positional arguments', async () => {
      const taskId = await tracker.create(
        'task-123',
        'tenant-1',
        'my-task',
        'Hello',
      )

      expect(taskId).toBe('task-123')

      await new Promise(resolve => setTimeout(resolve, 50))

      const task = await tracker.get('task-123', 'tenant-1')
      expect(task?.name).toBe('my-task')
      expect(task?.message).toBe('Hello')
    })

    it('should use provided ID', async () => {
      const taskId = await tracker.create({
        id: 'custom-id',
        tenantId: 'tenant-1',
        name: 'test-task',
      })

      expect(taskId).toBe('custom-id')
    })

    it('should generate ID if not provided', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'test-task',
      })

      expect(taskId).toBeDefined()
      expect(taskId.length).toBeGreaterThan(0)
    })

    it('should throw when tracker is shutdown', async () => {
      await tracker.shutdown()

      await expect(
        tracker.create({
          tenantId: 'tenant-1',
          name: 'test-task',
        }),
      ).rejects.toThrow('TaskTracker is shutdown')
    })

    it('should publish task immediately after creation', async () => {
      const received: any[] = []
      tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.create('task-1', 'tenant-1', 'test-task')

      expect(received.length).toBe(1)
      expect(received[0].status).toBe('QUEUED')
    })
  })

  describe('start', () => {
    it('should mark task as running', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.start('task-1', 'tenant-1', 'Starting execution...')

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('RUNNING')
      expect(task?.message).toBe('Starting execution...')
      expect(task?.progress).toBe(0)
    })

    it('should publish start update', async () => {
      const received: any[] = []
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.start('task-1', 'tenant-1')

      expect(received.some(s => s.status === 'RUNNING')).toBe(true)
    })

    it('should be no-op when shutdown', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.shutdown()

      // Should not throw
      await tracker.start('task-1', 'tenant-1')
    })
  })

  describe('progress', () => {
    it('should update progress with number', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.progress('task-1', 'tenant-1', 50, 'Halfway done')

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.progress).toBe(50)
      expect(task?.message).toBe('Halfway done')
    })

    it('should update progress with options object', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.progress('task-1', 'tenant-1', {
        progress: 75,
        message: 'Almost there',
      })

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.progress).toBe(75)
      expect(task?.message).toBe('Almost there')
    })

    it('should clamp progress to 0-100', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.progress('task-1', 'tenant-1', -10)
      let task = await tracker.get('task-1', 'tenant-1')
      expect(task?.progress).toBe(0)

      await tracker.progress('task-1', 'tenant-1', 150)
      task = await tracker.get('task-1', 'tenant-1')
      expect(task?.progress).toBe(100)
    })

    it('should publish progress updates', async () => {
      const received: any[] = []
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.progress('task-1', 'tenant-1', 25)
      await tracker.progress('task-1', 'tenant-1', 50)
      await tracker.progress('task-1', 'tenant-1', 75)

      expect(received.length).toBe(3)
      expect(received.map(r => r.progress)).toEqual([25, 50, 75])
    })
  })

  describe('complete', () => {
    it('should mark task as completed', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.complete('task-1', 'tenant-1', { success: true })

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('COMPLETED')
      expect(task?.progress).toBe(100)
      expect(task?.result).toEqual({ success: true })
      expect(task?.completedAt).toBeDefined()
    })

    it('should work without result', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.complete('task-1', 'tenant-1')

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('COMPLETED')
      expect(task?.result).toBeUndefined()
    })

    it('should publish completion update', async () => {
      const received: any[] = []
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.complete('task-1', 'tenant-1', { data: 'result' })

      expect(received.some(s => s.status === 'COMPLETED')).toBe(true)
      expect(received.find(s => s.status === 'COMPLETED')?.result).toEqual({
        data: 'result',
      })
    })
  })

  describe('fail', () => {
    it('should mark task as failed with string error', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.fail('task-1', 'tenant-1', 'Something went wrong')

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('FAILED')
      expect(task?.error).toBe('Something went wrong')
      expect(task?.completedAt).toBeDefined()
    })

    it('should mark task as failed with Error object', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.fail('task-1', 'tenant-1', new Error('Connection timeout'))

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('FAILED')
      expect(task?.error).toBe('Connection timeout')
    })

    it('should publish failure update', async () => {
      const received: any[] = []
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.fail('task-1', 'tenant-1', 'Error!')

      expect(received.some(s => s.status === 'FAILED')).toBe(true)
    })
  })

  describe('cancel', () => {
    it('should mark task as cancelled', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.cancel('task-1', 'tenant-1', 'User requested')

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('CANCELLED')
      expect(task?.message).toBe('User requested')
      expect(task?.completedAt).toBeDefined()
    })
  })

  describe('get', () => {
    it('should return task state', async () => {
      await tracker.create('task-1', 'tenant-1', 'test-task', 'Initial')
      await new Promise(resolve => setTimeout(resolve, 50))

      const task = await tracker.get('task-1', 'tenant-1')

      expect(task).toBeDefined()
      expect(task?.id).toBe('task-1')
      expect(task?.tenantId).toBe('tenant-1')
    })

    it('should return null for non-existent task', async () => {
      const task = await tracker.get('non-existent', 'tenant-1')
      expect(task).toBeNull()
    })
  })

  describe('subscribe', () => {
    it('should subscribe to task updates', async () => {
      const received: any[] = []

      const unsubscribe = tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.create('task-1', 'tenant-1', 'test-task')
      await new Promise(resolve => setTimeout(resolve, 50))
      await tracker.start('task-1', 'tenant-1')
      await tracker.progress('task-1', 'tenant-1', 50)
      await tracker.complete('task-1', 'tenant-1')

      expect(received.length).toBeGreaterThan(0)
      expect(received.some(s => s.status === 'QUEUED')).toBe(true)
      expect(received.some(s => s.status === 'RUNNING')).toBe(true)
      expect(received.some(s => s.status === 'COMPLETED')).toBe(true)

      unsubscribe()
    })

    it('should return unsubscribe function', async () => {
      const received: any[] = []

      const unsubscribe = tracker.subscribe('task-1', 'tenant-1', state => {
        received.push(state)
      })

      await tracker.create('task-1', 'tenant-1', 'test-task')
      expect(received.length).toBe(1)

      unsubscribe()

      await new Promise(resolve => setTimeout(resolve, 50))
      await tracker.start('task-1', 'tenant-1')

      // Should not receive any more updates
      expect(received.length).toBe(1)
    })
  })

  describe('stats', () => {
    it('should return buffer stats', async () => {
      const stats = tracker.stats
      expect(stats).toHaveProperty('bufferSize')
      expect(stats).toHaveProperty('pendingFlushes')
    })
  })

  describe('shutdown', () => {
    it('should drain buffer on shutdown', async () => {
      // Ensure real timers for this test
      vi.useRealTimers()

      // Create a fresh connector and tracker with high thresholds to prevent auto-flush
      const shutdownConnector = new InMemoryTaskTrackerConnector()
      const shutdownTracker = new TaskTracker(shutdownConnector, {
        flushIntervalMs: 600000, // 10 minutes
        flushThreshold: 10000, // High threshold
        bufferStrategy: 'STATIC',
      })

      // Create a task - will be buffered, not immediately persisted
      await shutdownTracker.create('task-1', 'tenant-1', 'test-task')

      // Verify task is in buffer, not yet in connector
      expect(shutdownTracker.stats.bufferSize).toBe(1)
      expect(shutdownConnector.size).toBe(0)

      // Shutdown should drain the buffer and persist tasks
      await shutdownTracker.shutdown()

      // Task should now be persisted in connector
      expect(shutdownConnector.size).toBe(1)
      const tasks = shutdownConnector.getAllTasks('tenant-1')
      expect(tasks.length).toBe(1)
      expect(tasks[0].id).toBe('task-1')
    })

    it('should set isShutdown flag', async () => {
      expect(tracker.isShutdown).toBe(false)

      await tracker.shutdown()

      expect(tracker.isShutdown).toBe(true)
    })

    it('should be idempotent', async () => {
      await tracker.shutdown()
      await tracker.shutdown() // Should not throw
    })

    it('should close connector if supported', async () => {
      const closeSpy = vi.spyOn(connector, 'close')

      await tracker.shutdown()

      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe('full lifecycle', () => {
    it('should handle complete task lifecycle', async () => {
      const states: any[] = []
      tracker.subscribe('task-1', 'tenant-1', state => {
        states.push({ ...state })
      })

      // Create
      await tracker.create('task-1', 'tenant-1', 'process-order')
      await new Promise(resolve => setTimeout(resolve, 50))

      // Start
      await tracker.start('task-1', 'tenant-1', 'Starting processing...')

      // Progress
      await tracker.progress('task-1', 'tenant-1', 25, 'Loading data...')
      await tracker.progress('task-1', 'tenant-1', 50, 'Processing...')
      await tracker.progress('task-1', 'tenant-1', 75, 'Saving results...')

      // Complete
      await tracker.complete('task-1', 'tenant-1', { orderId: 'order-123' })

      // Verify final state
      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('COMPLETED')
      expect(task?.progress).toBe(100)
      expect(task?.result).toEqual({ orderId: 'order-123' })

      // Verify we received all updates
      expect(states.some(s => s.status === 'QUEUED')).toBe(true)
      expect(states.some(s => s.status === 'RUNNING')).toBe(true)
      expect(states.some(s => s.status === 'COMPLETED')).toBe(true)
      expect(states.some(s => s.progress === 25)).toBe(true)
      expect(states.some(s => s.progress === 50)).toBe(true)
      expect(states.some(s => s.progress === 75)).toBe(true)
    })

    it('should handle task failure lifecycle', async () => {
      await tracker.create('task-1', 'tenant-1', 'failing-task')
      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.start('task-1', 'tenant-1')
      await tracker.progress('task-1', 'tenant-1', 30)
      await tracker.fail('task-1', 'tenant-1', new Error('Network error'))

      const task = await tracker.get('task-1', 'tenant-1')
      expect(task?.status).toBe('FAILED')
      expect(task?.error).toBe('Network error')
    })

    it('should handle multiple concurrent tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3']

      // Create all tasks
      await Promise.all(
        taskIds.map(id => tracker.create(id, 'tenant-1', `task-${id}`)),
      )

      await new Promise(resolve => setTimeout(resolve, 50))

      // Progress all tasks
      await Promise.all([
        tracker.progress('task-1', 'tenant-1', 50),
        tracker.progress('task-2', 'tenant-1', 75),
        tracker.progress('task-3', 'tenant-1', 25),
      ])

      // Complete all tasks
      await Promise.all([
        tracker.complete('task-1', 'tenant-1', { id: 1 }),
        tracker.complete('task-2', 'tenant-1', { id: 2 }),
        tracker.complete('task-3', 'tenant-1', { id: 3 }),
      ])

      // Verify all completed
      for (const id of taskIds) {
        const task = await tracker.get(id, 'tenant-1')
        expect(task?.status).toBe('COMPLETED')
      }
    })
  })

  describe('configuration', () => {
    it('should use default config when not provided', () => {
      const defaultTracker = new TaskTracker(connector)
      expect(defaultTracker).toBeDefined()
    })

    it('should merge partial config with defaults', () => {
      const customTracker = new TaskTracker(connector, {
        flushIntervalMs: 100,
      })
      expect(customTracker).toBeDefined()
    })
  })

  describe('ownerId', () => {
    it('should create a task with ownerId', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'test-task',
        ownerId: 'user-123',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.ownerId).toBe('user-123')
    })

    it('should create a task without ownerId', async () => {
      const taskId = await tracker.create({
        tenantId: 'tenant-1',
        name: 'test-task',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const task = await tracker.get(taskId, 'tenant-1')
      expect(task?.ownerId).toBeUndefined()
    })
  })

  describe('listByOwner', () => {
    it('should return tasks for a specific owner', async () => {
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task1',
        ownerId: 'user-1',
      })
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task2',
        ownerId: 'user-1',
      })
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task3',
        ownerId: 'user-2',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const user1Tasks = await tracker.listByOwner('tenant-1', 'user-1')
      expect(user1Tasks).toHaveLength(2)
      expect(user1Tasks.every(t => t.ownerId === 'user-1')).toBe(true)

      const user2Tasks = await tracker.listByOwner('tenant-1', 'user-2')
      expect(user2Tasks).toHaveLength(1)
      expect(user2Tasks[0].ownerId).toBe('user-2')
    })

    it('should filter by status', async () => {
      const taskId1 = await tracker.create({
        tenantId: 'tenant-1',
        name: 'task1',
        ownerId: 'user-1',
      })
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task2',
        ownerId: 'user-1',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Start task1 to make it RUNNING
      await tracker.start(taskId1, 'tenant-1')

      const runningTasks = await tracker.listByOwner('tenant-1', 'user-1', {
        status: 'RUNNING',
      })
      expect(runningTasks).toHaveLength(1)
      expect(runningTasks[0].status).toBe('RUNNING')

      const queuedTasks = await tracker.listByOwner('tenant-1', 'user-1', {
        status: 'QUEUED',
      })
      expect(queuedTasks).toHaveLength(1)
      expect(queuedTasks[0].status).toBe('QUEUED')
    })

    it('should filter by multiple statuses', async () => {
      const taskId1 = await tracker.create({
        tenantId: 'tenant-1',
        name: 'task1',
        ownerId: 'user-1',
      })
      const taskId2 = await tracker.create({
        tenantId: 'tenant-1',
        name: 'task2',
        ownerId: 'user-1',
      })
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task3',
        ownerId: 'user-1',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      await tracker.start(taskId1, 'tenant-1')
      await tracker.complete(taskId2, 'tenant-1')
      // task3 remains QUEUED

      const activeTasks = await tracker.listByOwner('tenant-1', 'user-1', {
        status: ['QUEUED', 'RUNNING'],
      })
      expect(activeTasks).toHaveLength(2)
      expect(activeTasks.some(t => t.status === 'QUEUED')).toBe(true)
      expect(activeTasks.some(t => t.status === 'RUNNING')).toBe(true)
    })

    it('should respect limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await tracker.create({
          tenantId: 'tenant-1',
          name: `task${i}`,
          ownerId: 'user-1',
        })
      }

      await new Promise(resolve => setTimeout(resolve, 50))

      const limitedTasks = await tracker.listByOwner('tenant-1', 'user-1', {
        limit: 3,
      })
      expect(limitedTasks).toHaveLength(3)
    })

    it('should return empty array for owner with no tasks', async () => {
      const tasks = await tracker.listByOwner('tenant-1', 'non-existent-owner')
      expect(tasks).toHaveLength(0)
    })

    it('should isolate tasks by tenant', async () => {
      await tracker.create({
        tenantId: 'tenant-1',
        name: 'task1',
        ownerId: 'user-1',
      })
      await tracker.create({
        tenantId: 'tenant-2',
        name: 'task2',
        ownerId: 'user-1',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const tenant1Tasks = await tracker.listByOwner('tenant-1', 'user-1')
      expect(tenant1Tasks).toHaveLength(1)
      expect(tenant1Tasks[0].tenantId).toBe('tenant-1')

      const tenant2Tasks = await tracker.listByOwner('tenant-2', 'user-1')
      expect(tenant2Tasks).toHaveLength(1)
      expect(tenant2Tasks[0].tenantId).toBe('tenant-2')
    })

    it('should sort tasks by createdAt descending', async () => {
      await tracker.create({
        id: 'task-1',
        tenantId: 'tenant-1',
        name: 'first',
        ownerId: 'user-1',
      })
      await new Promise(resolve => setTimeout(resolve, 20))
      await tracker.create({
        id: 'task-2',
        tenantId: 'tenant-1',
        name: 'second',
        ownerId: 'user-1',
      })
      await new Promise(resolve => setTimeout(resolve, 20))
      await tracker.create({
        id: 'task-3',
        tenantId: 'tenant-1',
        name: 'third',
        ownerId: 'user-1',
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const tasks = await tracker.listByOwner('tenant-1', 'user-1')
      expect(tasks).toHaveLength(3)
      expect(tasks[0].name).toBe('third')
      expect(tasks[1].name).toBe('second')
      expect(tasks[2].name).toBe('first')
    })
  })
})

// pnpm exec vitest run src/global-close.spec.ts
import { performance } from 'node:perf_hooks'
import Redis from 'ioredis'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'

const doubles = vi.hoisted(() => ({ worker: vi.fn(), queue: vi.fn() }))
vi.mock('bullmq', () => ({
  Worker: function Worker() {
    return doubles.worker()
  },
  Queue: function Queue() {
    return doubles.queue()
  },
}))
function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function worker() {
  const job = {
    data: {},
    extendLock: vi.fn(async () => 1),
    moveToCompleted: vi.fn(async () => {}),
    moveToFailed: vi.fn(async () => {}),
  }
  const value = {
    job,
    opts: { lockDuration: 30000 },
    waitUntilReady: vi.fn(async () => {}),
    getNextJob: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(undefined),
    close: vi.fn(async () => {}),
  }
  doubles.worker.mockReturnValue(value)
  return value
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
const clients: Redis[] = []
function connector() {
  const redis = new Redis({ lazyConnect: true })
  clients.push(redis)
  return new BullMQConnector({ redisInstance: redis })
}
function dispatch(c: BullMQConnector, handleTask: () => Promise<unknown>) {
  return c.processIncomingDispatch({
    validQueueNames: new Set(['queue']),
    batchSize: 1,
    concurrency: 1,
    timeBudgetMs: 5000,
    handleTask,
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  doubles.worker.mockReset()
  doubles.queue.mockReset()
  doubles.queue.mockReturnValue({
    close: vi.fn(async () => {}),
    add: vi.fn(async () => ({ id: 'followup' })),
  })
})
afterEach(() => {
  for (const redis of clients.splice(0)) {
    redis.disconnect()
  }
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('joins handler, follow-up producer, ACK and temporary-worker cleanup before queue cleanup', async () => {
  const c = connector()
  const w = worker()
  const held = deferred()
  const ack = deferred()
  const cleanup = deferred()
  w.job.moveToCompleted.mockReturnValue(ack.promise)
  w.close.mockReturnValue(cleanup.promise)
  const queue = c.getQueue('queue')
  const run = dispatch(c, async () => {
    await held.promise
    await c.addJob('queue', 'followup', {})
  })
  await vi.advanceTimersByTimeAsync(0)
  const close = c.close()
  const closing = observe(close)
  expect(c.close()).toBe(close)
  await vi.advanceTimersByTimeAsync(35000)
  expect(w.job.extendLock).toHaveBeenCalled()
  expect(closing.settled()).toBe(false)
  expect(queue.close).not.toHaveBeenCalled()
  held.resolve()
  await vi.advanceTimersByTimeAsync(0)
  expect(queue.add).toHaveBeenCalledOnce()
  expect(w.job.moveToCompleted).toHaveBeenCalledOnce()
  expect(w.close).not.toHaveBeenCalled()
  expect(closing.settled()).toBe(false)
  expect(queue.close).not.toHaveBeenCalled()
  ack.resolve()
  await vi.advanceTimersByTimeAsync(0)
  expect(w.close).toHaveBeenCalledOnce()
  expect(closing.settled()).toBe(false)
  expect(queue.close).not.toHaveBeenCalled()
  cleanup.resolve()
  await run
  expect(await closing.result).toEqual({ ok: true, value: undefined })
  expect(queue.close).toHaveBeenCalledOnce()
  expect(c.close()).toBe(close)
})

it('joins held sibling before propagating undefined rejection and retaining resources', async () => {
  const c = connector()
  const a = worker()
  const b = worker()
  doubles.worker.mockReset().mockReturnValueOnce(a).mockReturnValueOnce(b)
  const held = deferred()
  const failed = deferred()
  a.waitUntilReady.mockReturnValue(failed.promise)
  const queue = c.getQueue('queue')
  const first = observe(dispatch(c, async () => {}))
  const second = observe(dispatch(c, () => held.promise))
  await vi.advanceTimersByTimeAsync(0)
  const close = c.close()
  const closing = observe(close)
  failed.reject(undefined)
  await vi.advanceTimersByTimeAsync(0)
  expect(first.settled()).toBe(true)
  expect(closing.settled()).toBe(false)
  expect(queue.close).not.toHaveBeenCalled()
  held.resolve()
  await second.result
  expect(await closing.result).toEqual({ ok: false, error: undefined })
  expect(queue.close).not.toHaveBeenCalled()
  expect(c.close()).toBe(close)
  await expect(dispatch(c, async () => {})).rejects.toThrow()
})

it('registers before a reentrant parameter getter closes the connector', async () => {
  const c = connector()
  worker()
  const held = deferred()
  let close: Promise<void> | undefined
  let repeated: Promise<void> | undefined
  const run = c.processIncomingDispatch({
    get handleTask() {
      close = c.close()
      repeated = c.close()
      return () => held.promise
    },
    validQueueNames: new Set(['queue']),
    timeBudgetMs: 5000,
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(close).toBeDefined()
  expect(repeated).toBe(close)
  const closing = observe(close!)
  await vi.advanceTimersByTimeAsync(0)
  expect(closing.settled()).toBe(false)
  held.resolve()
  await run
  expect(await closing.result).toEqual({ ok: true, value: undefined })
})

it('fences before pending close callbacks and never inspects denied parameters', async () => {
  const c = connector()
  const queue = c.getQueue('queue')
  const nested: Promise<void>[] = []
  let reentered = false
  vi.mocked(queue.close).mockImplementation(async () => {
    if (!reentered) {
      reentered = true
      nested.push(c.close())
    }
  })
  const close = c.close()
  const getter = vi.fn(() => async () => {})
  await expect(
    c.processIncomingDispatch({
      get handleTask() {
        return getter()
      },
    }),
  ).rejects.toThrow()
  await close
  expect(nested).toEqual([close])
  await expect(dispatch(c, async () => {})).rejects.toThrow()
  expect(getter).not.toHaveBeenCalled()
  expect(doubles.worker).not.toHaveBeenCalled()
})

it('does not retain historical failures or fence an independent connector', async () => {
  const a = connector()
  const b = connector()
  const w = worker()
  w.waitUntilReady.mockRejectedValueOnce(new Error('historical'))
  await expect(dispatch(a, async () => {})).rejects.toThrow('historical')
  await a.close()
  worker()
  await expect(dispatch(b, async () => {})).resolves.toEqual({
    processed: 1,
    failed: 0,
  })
  await b.close()
})

it('preserves failure observation order rather than dispatch admission order', async () => {
  const c = connector()
  const a = worker()
  const b = worker()
  const first = deferred()
  const second = deferred()
  a.waitUntilReady.mockReturnValue(first.promise)
  b.waitUntilReady.mockReturnValue(second.promise)
  doubles.worker.mockReset().mockReturnValueOnce(a).mockReturnValueOnce(b)
  const runs = [
    observe(dispatch(c, async () => {})),
    observe(dispatch(c, async () => {})),
  ]
  const closing = observe(c.close())
  second.reject(undefined)
  await vi.advanceTimersByTimeAsync(0)
  first.reject(new Error('later'))
  await Promise.all(runs.map(run => run.result))
  expect(await closing.result).toEqual({ ok: false, error: undefined })
})

it('captures a same-turn rejection before close without treating it as retired history', async () => {
  const c = connector()
  const a = worker()
  const b = worker()
  const rejected = deferred()
  const held = deferred()
  const error = new Error('rejected immediately before close')
  a.waitUntilReady.mockReturnValue(rejected.promise)
  doubles.worker.mockReset().mockReturnValueOnce(a).mockReturnValueOnce(b)
  const first = observe(dispatch(c, async () => {}))
  const second = observe(dispatch(c, () => held.promise))
  const queue = c.getQueue('queue')
  await vi.advanceTimersByTimeAsync(0)
  rejected.reject(error)
  // No microtask turn: the admitted dispatch has not retired its record.
  const closing = observe(c.close())
  await vi.advanceTimersByTimeAsync(0)
  expect(first.settled()).toBe(true)
  expect(closing.settled()).toBe(false)
  expect(queue.close).not.toHaveBeenCalled()
  held.resolve()
  await second.result
  expect(await closing.result).toEqual({ ok: false, error })
  expect(queue.close).not.toHaveBeenCalled()
})

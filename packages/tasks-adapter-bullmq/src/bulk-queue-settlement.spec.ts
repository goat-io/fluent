// pnpm exec vitest run src/bulk-queue-settlement.spec.ts
import Redis from 'ioredis'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'

const doubles = vi.hoisted(() => ({ queue: vi.fn() }))
vi.mock('bullmq', () => ({
  Queue: function Queue(name: string) {
    return doubles.queue(name)
  },
  Worker: vi.fn(),
}))
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
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
const clients: Redis[] = []
function connector(onAfterQueue?: () => Promise<void>) {
  const redis = new Redis({ lazyConnect: true })
  clients.push(redis)
  return new BullMQConnector({
    redisInstance: redis,
    tenantId: 'tenant',
    onAfterQueue,
  })
}
const jobs = ['first', 'second'].map(taskName => ({
  taskName,
  uniqueTaskName: taskName,
  taskBody: {},
}))
async function turn() {
  await new Promise<void>(resolve => setImmediate(resolve))
}
beforeEach(() => doubles.queue.mockReset())
afterEach(() => {
  for (const redis of clients.splice(0)) {
    redis.disconnect()
  }
  vi.restoreAllMocks()
})

it.each([new Error('first failure'), undefined])(
  'joins a held sibling before rejecting with %s',
  async error => {
    const held = deferred<Array<{ id: string }>>()
    doubles.queue
      .mockReturnValueOnce({ addBulk: vi.fn().mockRejectedValue(error) })
      .mockReturnValueOnce({ addBulk: vi.fn().mockReturnValue(held.promise) })
    const run = observe(connector().bulkQueue(jobs))
    await turn()
    const premature = run.settled()
    held.resolve([{ id: 'second' }])
    expect(await run.result).toEqual({ ok: false, error })
    expect(premature).toBe(false)
  },
)

it('joins a sibling afterQueue hook while preserving its nonfatal failure', async () => {
  const held = deferred<void>()
  const error = new Error('enqueue failure')
  const hook = vi.fn().mockReturnValue(held.promise)
  doubles.queue
    .mockReturnValueOnce({ addBulk: vi.fn().mockRejectedValue(error) })
    .mockReturnValueOnce({
      addBulk: vi.fn().mockResolvedValue([{ id: 'second' }]),
    })
  const run = observe(connector(hook).bulkQueue(jobs))
  await turn()
  const premature = run.settled()
  held.reject(new Error('nonfatal hook'))
  expect(await run.result).toEqual({ ok: false, error })
  expect(hook).toHaveBeenCalledOnce()
  expect(premature).toBe(false)
})

it('preserves observation order rather than bucket input order', async () => {
  const first = deferred<Array<{ id: string }>>()
  const second = deferred<Array<{ id: string }>>()
  doubles.queue
    .mockReturnValueOnce({ addBulk: vi.fn().mockReturnValue(first.promise) })
    .mockReturnValueOnce({ addBulk: vi.fn().mockReturnValue(second.promise) })
  const run = observe(connector().bulkQueue(jobs))
  const error = new Error('second fails first')
  second.reject(error)
  await turn()
  const premature = run.settled()
  first.reject(new Error('later first bucket failure'))
  expect(await run.result).toEqual({ ok: false, error })
  expect(premature).toBe(false)
})

it.each(['getQueue', 'addBulk'])(
  'a synchronous %s failure still admits and joins siblings',
  async method => {
    const error = new Error('synchronous failure')
    const held = deferred<Array<{ id: string }>>()
    const sibling = vi.fn().mockReturnValue(held.promise)
    doubles.queue
      .mockImplementationOnce(() => {
        if (method === 'getQueue') {
          throw error
        }
        return {
          addBulk: () => {
            throw error
          },
        }
      })
      .mockReturnValueOnce({ addBulk: sibling })
    const run = observe(connector().bulkQueue(jobs))
    await turn()
    const premature = run.settled()
    held.resolve([{ id: 'second' }])
    expect(await run.result).toEqual({ ok: false, error })
    expect(sibling).toHaveBeenCalledOnce()
    expect(premature).toBe(false)
  },
)

it('preserves input order across buckets and swallows hook failures', async () => {
  const first = deferred<Array<{ id: string }>>()
  doubles.queue
    .mockReturnValueOnce({ addBulk: vi.fn().mockReturnValue(first.promise) })
    .mockReturnValueOnce({ addBulk: vi.fn().mockResolvedValue([{ id: 'b' }]) })
  const hook = vi.fn().mockRejectedValue(new Error('nonfatal'))
  const run = connector(hook).bulkQueue([
    ...jobs,
    { ...jobs[0]!, uniqueTaskName: 'third' },
  ])
  await turn()
  first.resolve([{ id: 'a' }, { id: 'c' }])
  expect((await run).map(status => status.id)).toEqual([
    'first:a',
    'second:b',
    'first:c',
  ])
  expect(hook).toHaveBeenCalledTimes(3)
})

it('returns empty results without creating queues', async () => {
  expect(await connector().bulkQueue([])).toEqual([])
  expect(doubles.queue).not.toHaveBeenCalled()
})

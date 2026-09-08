// pnpm exec vitest run src/shutdown.spec.ts
import { EventEmitter } from 'node:events'
import type { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'

const doubles = vi.hoisted(() => ({ worker: vi.fn(), queue: vi.fn() }))
vi.mock('bullmq', () => ({
  Worker: function Worker(...args: unknown[]) {
    return doubles.worker(...args)
  },
  Queue: function Queue(...args: unknown[]) {
    return doubles.queue(...args)
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
  const events = new EventEmitter()
  const running = deferred()
  return Object.assign(events, {
    running,
    closing: false,
    run: vi.fn(() => running.promise),
    pause: vi.fn(async () => running.resolve()),
    close: vi.fn(async () => {}),
    isPaused: vi.fn(() => true),
    isRunning: vi.fn(() => true),
  })
}

function observe(promise: Promise<void>) {
  let settled = false
  const result = promise.then(
    () => {
      settled = true
      return { ok: true as const }
    },
    error => {
      settled = true
      return { ok: false as const, error }
    },
  )
  return { result, settled: () => settled }
}

async function turn() {
  await vi.advanceTimersByTimeAsync(0)
}

async function listen(connector: BullMQConnector, names = ['a', 'b']) {
  const promise = connector.listen({
    tasks: names.map(taskName => ({
      taskName,
      concurrency: 7,
      handle: async (value: unknown) => value,
    })),
  })
  // Preserve the existing listener startup delay; do not bypass global setup.
  await vi.advanceTimersByTimeAsync(1000)
  return promise
}

beforeEach(() => {
  vi.useFakeTimers()
  doubles.worker.mockReset()
  doubles.queue.mockReset()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('listener-owned stop', () => {
  it.each([
    ['on', new Error('registration')],
    ['on', undefined],
    ['removeListener', new Error('removal')],
    ['removeListener', undefined],
  ] as const)(
    'joins sibling and rejects diagnostic hook %s failure: %s',
    async (method, error) => {
      const a = worker()
      const b = worker()
      const held = deferred()
      vi.spyOn(a, method).mockImplementation(() => {
        throw error
      })
      b.close.mockReturnValue(held.promise)
      doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
      const handle = await listen(new BullMQConnector())
      const first = handle.stop()
      const closing = observe(first)
      await turn()
      expect(b.close).toHaveBeenCalledOnce()
      expect(closing.settled()).toBe(false)
      held.resolve()
      expect(await closing.result).toEqual({ ok: false, error })
      expect(handle.stop()).toBe(first)
    },
  )

  it('keeps earlier close failure when listener removal also throws', async () => {
    const a = worker()
    const firstError = new Error('close first')
    a.close.mockRejectedValue(firstError)
    vi.spyOn(a, 'removeListener').mockImplementation(() => {
      throw new Error('remove later')
    })
    doubles.worker.mockReturnValue(a)
    const handle = await listen(new BullMQConnector(), ['a'])
    expect(await observe(handle.stop()).result).toEqual({
      ok: false,
      error: firstError,
    })
  })
  it('starts each worker explicitly with autorun disabled and preserves handler values', async () => {
    const a = worker()
    doubles.worker.mockReturnValue(a)
    const connector = new BullMQConnector()
    const handle = await listen(connector, ['a'])
    const [, process, options] = doubles.worker.mock.calls[0]!
    expect(options).toMatchObject({ autorun: false, concurrency: 7 })
    expect(a.run).toHaveBeenCalledOnce()
    await expect(process({ data: 'value' })).resolves.toBe('value')
    await handle.stop()
  })

  it('shares the exact stop promise and marks the group not running immediately', async () => {
    const a = worker()
    const held = deferred()
    a.pause.mockReturnValue(held.promise)
    doubles.worker.mockReturnValue(a)
    const handle = await listen(new BullMQConnector(), ['a'])
    const first = handle.stop()
    const closing = observe(first)
    expect(handle.stop()).toBe(first)
    expect(handle.isRunning()).toBe(false)
    await turn()
    expect(closing.settled()).toBe(false)
    a.running.resolve()
    held.resolve()
    await closing.result
  })

  it('pauses all workers and joins every run before closing any worker', async () => {
    const a = worker()
    const b = worker()
    a.pause.mockResolvedValue(undefined)
    b.pause.mockResolvedValue(undefined)
    doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
    const handle = await listen(new BullMQConnector())
    const closing = observe(handle.stop())
    await turn()
    expect(a.pause).toHaveBeenCalledWith(false)
    expect(b.pause).toHaveBeenCalledWith(false)
    expect(a.close).not.toHaveBeenCalled()
    expect(b.close).not.toHaveBeenCalled()
    a.running.resolve()
    await turn()
    expect(closing.settled()).toBe(false)
    expect(a.close).not.toHaveBeenCalled()
    b.running.resolve()
    expect(await closing.result).toEqual({ ok: true })
    expect(a.close).toHaveBeenCalledOnce()
    expect(b.close).toHaveBeenCalledOnce()
  })

  it.each([new Error('pause failed'), undefined])(
    'retains every worker and waits for held runs after pause failure: %s',
    async error => {
      const a = worker()
      const b = worker()
      a.pause.mockRejectedValue(error)
      b.pause.mockResolvedValue(undefined)
      doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
      const handle = await listen(new BullMQConnector())
      const closing = observe(handle.stop())
      await turn()
      expect(b.pause).toHaveBeenCalledWith(false)
      expect(closing.settled()).toBe(false)
      a.running.resolve()
      await turn()
      expect(closing.settled()).toBe(false)
      b.running.resolve()
      expect(await closing.result).toEqual({ ok: false, error })
      expect(a.close).not.toHaveBeenCalled()
      expect(b.close).not.toHaveBeenCalled()
    },
  )

  it('joins startup even when pause resolves before the main loop exists', async () => {
    const a = worker()
    a.pause.mockResolvedValue(undefined)
    doubles.worker.mockReturnValue(a)
    const handle = await listen(new BullMQConnector(), ['a'])
    const closing = observe(handle.stop())
    await turn()
    expect(closing.settled()).toBe(false)
    expect(a.close).not.toHaveBeenCalled()
    a.running.resolve()
    expect(await closing.result).toEqual({ ok: true })
  })

  it.each([new Error('run failed'), undefined])(
    'observes an early run failure and preserves it at stop: %s',
    async error => {
      const a = worker()
      doubles.worker.mockReturnValue(a)
      const handle = await listen(new BullMQConnector(), ['a'])
      expect(a.run).toHaveBeenCalledOnce()
      a.running.reject(error)
      await turn()
      expect(await observe(handle.stop()).result).toEqual({ ok: false, error })
      expect(a.close).not.toHaveBeenCalled()
    },
  )

  it('captures swallowed close error events while still joining sibling closes', async () => {
    const a = worker()
    const b = worker()
    const held = deferred()
    const error = new Error('cleanup emitted error')
    a.close.mockImplementation(async () => {
      // BullMQ catches cleanup errors, emits them, and may fulfill close().
      try {
        a.emit('error', error)
      } catch {
        // QueueBase.emit itself catches unhandled error events.
      }
    })
    b.close.mockReturnValue(held.promise)
    doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
    const handle = await listen(new BullMQConnector())
    const closing = observe(handle.stop())
    await turn()
    expect(b.close).toHaveBeenCalledOnce()
    expect(closing.settled()).toBe(false)
    held.resolve()
    expect(await closing.result).toEqual({ ok: false, error })
  })

  it('does not pause another listener or lose its same-key registration', async () => {
    const a = worker()
    const b = worker()
    doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
    const connector = new BullMQConnector()
    const first = await listen(connector, ['same'])
    const second = await listen(connector, ['same'])
    await first.stop()
    expect(b.pause).not.toHaveBeenCalled()
    expect(b.close).not.toHaveBeenCalled()
    expect(second.isRunning()).toBe(true)
    // Observe retained registration through the existing public connector API;
    // this does not assert broader connector-close drain semantics.
    await connector.close()
    expect(b.close).toHaveBeenCalledOnce()
  })

  it('listener stop never closes queues or externally supplied Redis', async () => {
    const a = worker()
    const redis = { disconnect: vi.fn(), quit: vi.fn() }
    const queue = { close: vi.fn(async () => {}) }
    doubles.worker.mockReturnValue(a)
    doubles.queue.mockReturnValue(queue)
    const connector = new BullMQConnector({
      redisInstance: redis as unknown as Redis,
    })
    connector.getQueue('follow-up')
    const handle = await listen(connector, ['a'])
    await handle.stop()
    expect(queue.close).not.toHaveBeenCalled()
    expect(redis.disconnect).not.toHaveBeenCalled()
    expect(redis.quit).not.toHaveBeenCalled()
  })

  it.each(['pause', 'close'] as const)(
    'joins siblings after synchronous %s throws undefined',
    async stage => {
      const a = worker()
      const b = worker()
      const held = deferred()
      a[stage].mockImplementation(() => {
        throw undefined
      })
      b[stage].mockReturnValue(held.promise)
      doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
      const handle = await listen(new BullMQConnector())
      const first = handle.stop()
      const closing = observe(first)
      await turn()
      expect(b[stage]).toHaveBeenCalledOnce()
      expect(closing.settled()).toBe(false)
      a.running.resolve()
      b.running.resolve()
      held.resolve()
      expect(await closing.result).toEqual({ ok: false, error: undefined })
      expect(handle.stop()).toBe(first)
      expect(a[stage]).toHaveBeenCalledOnce()
      if (stage === 'pause') {
        expect(a.close).not.toHaveBeenCalled()
        expect(b.close).not.toHaveBeenCalled()
      }
    },
  )

  it('owns stop before reentrant pause callbacks', async () => {
    const a = worker()
    doubles.worker.mockReturnValue(a)
    const handle = await listen(new BullMQConnector(), ['a'])
    let nested: Promise<void> | undefined
    a.pause.mockImplementation(async () => {
      nested = handle.stop()
      a.running.resolve()
    })
    const first = handle.stop()
    await first
    expect(nested).toBe(first)
    expect(a.pause).toHaveBeenCalledOnce()
    expect(a.close).toHaveBeenCalledOnce()
  })

  it('reports the first observed failure rather than input order', async () => {
    const a = worker()
    const b = worker()
    const late = deferred()
    const firstError = new Error('observed first')
    a.pause.mockReturnValue(late.promise)
    b.pause.mockRejectedValue(firstError)
    doubles.worker.mockReturnValueOnce(a).mockReturnValueOnce(b)
    const handle = await listen(new BullMQConnector())
    const closing = observe(handle.stop())
    await turn()
    late.reject(new Error('observed second'))
    a.running.resolve()
    b.running.resolve()
    expect(await closing.result).toEqual({ ok: false, error: firstError })
  })
})

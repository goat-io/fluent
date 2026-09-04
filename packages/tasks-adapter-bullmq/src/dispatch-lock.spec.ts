// pnpm exec vitest run src/dispatch-lock.spec.ts
import { performance } from 'node:perf_hooks'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'

const doubles = vi.hoisted(() => ({ worker: vi.fn() }))
vi.mock('bullmq', () => ({
  Worker: function Worker() {
    return doubles.worker()
  },
  Queue: vi.fn(),
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}
function job() {
  return {
    data: {},
    token: 'dispatch',
    extendLock: vi.fn(async () => 1),
    moveToCompleted: vi.fn(async () => {}),
    moveToFailed: vi.fn(async () => {}),
  }
}
function worker(jobs = [job()]) {
  const next = [...jobs]
  const value = {
    opts: { lockDuration: 30000 },
    waitUntilReady: vi.fn(async () => {}),
    getNextJob: vi.fn(async (_token: string) => next.shift()),
    close: vi.fn(async () => {}),
  }
  doubles.worker.mockReturnValue(value)
  return value
}
function start(handleTask: () => Promise<unknown>, batchSize = 1) {
  return new BullMQConnector().processIncomingDispatch({
    validQueueNames: new Set(['queue']),
    handleTask,
    batchSize,
    concurrency: 1,
    timeBudgetMs: 5000,
  })
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
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  doubles.worker.mockReset()
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('renews active and queued jobs beyond the fetch budget and stops after ACK', async () => {
  const a = job()
  const b = job()
  const held = deferred()
  const w = worker([a, b])
  const run = start(() => held.promise, 2)
  await vi.advanceTimersByTimeAsync(35000)
  expect(a.extendLock).toHaveBeenCalled()
  expect(b.extendLock).toHaveBeenCalled()
  expect(w.close).not.toHaveBeenCalled()
  held.resolve()
  expect(await run).toEqual({ processed: 2, failed: 0 })
  const calls = a.extendLock.mock.calls.length
  await vi.advanceTimersByTimeAsync(35000)
  expect(a.extendLock).toHaveBeenCalledTimes(calls)
})
it('uses separate cryptographic dispatch tokens and the same token for ACK', async () => {
  const a = job()
  const w = worker([a])
  await start(async () => {})
  const first = w.getNextJob.mock.calls[0]?.[0]
  worker()
  await start(async () => {})
  const second =
    doubles.worker.mock.results[1]?.value.getNextJob.mock.calls[0][0]
  expect(first).toMatch(/^[0-9a-f-]{36}$/)
  expect(second).not.toBe(first)
  expect(a.moveToCompleted).toHaveBeenCalledWith(undefined, first, false)
})
it.each(['sync', 'async'])(
  'owns successful sibling after %s pull failure',
  async mode => {
    const a = job()
    const held = deferred()
    const error = new Error('pull')
    const w = worker([a])
    w.getNextJob.mockImplementationOnce(() => {
      if (mode === 'sync') {
        throw error
      }
      return Promise.reject(error)
    })
    const run = observe(start(() => held.promise, 2))
    await vi.advanceTimersByTimeAsync(16000)
    expect(a.extendLock).toHaveBeenCalled()
    expect(run.settled()).toBe(false)
    expect(w.close).not.toHaveBeenCalled()
    held.resolve()
    expect(await run.result).toEqual({ ok: false, error })
    expect(a.moveToCompleted).toHaveBeenCalledOnce()
  },
)
it.each([undefined, new Error('renewal'), 0])(
  'surfaces renewal uncertainty %s after joining handler',
  async error => {
    const a = job()
    const held = deferred()
    const w = worker([a])
    a.extendLock.mockImplementation(async () => {
      if (error === 0) {
        return 0
      }
      throw error
    })
    const run = observe(start(() => held.promise))
    await vi.advanceTimersByTimeAsync(16000)
    expect(run.settled()).toBe(false)
    expect(w.close).not.toHaveBeenCalled()
    held.resolve()
    const result = await run.result
    expect(result.ok).toBe(false)
    if (result.ok === false && error !== 0) {
      expect(result.error).toBe(error)
    }
    expect(a.moveToCompleted).not.toHaveBeenCalled()
  },
)
it.each(['sync', 'async'])(
  'preserves %s handler failures as acknowledged failed counts',
  async mode => {
    const a = job()
    worker([a])
    const error = new Error('handler')
    const result = await start(() => {
      if (mode === 'sync') {
        throw error
      }
      return Promise.reject(error)
    })
    expect(result).toEqual({ processed: 0, failed: 1 })
    expect(a.moveToFailed).toHaveBeenCalledWith(
      error,
      expect.any(String),
      false,
    )
  },
)
it.each(['sync', 'async'])(
  'joins sibling ACK before rejecting %s undefined ACK failure',
  async mode => {
    const a = job()
    const b = job()
    const held = deferred()
    const w = worker([a, b])
    a.moveToCompleted.mockImplementation(() => {
      if (mode === 'sync') {
        throw undefined
      }
      return Promise.reject(undefined)
    })
    b.moveToCompleted.mockReturnValue(held.promise)
    const run = observe(start(async () => {}, 2))
    await vi.advanceTimersByTimeAsync(0)
    expect(run.settled()).toBe(false)
    expect(w.close).not.toHaveBeenCalled()
    held.resolve()
    expect(await run.result).toEqual({ ok: false, error: undefined })
  },
)
it('joins an ongoing renewal before ACK and never renews after ACK', async () => {
  const a = job()
  const held = deferred()
  const renewal = deferred()
  worker([a])
  a.extendLock.mockImplementation(async () => {
    await renewal.promise
    return 1
  })
  const run = start(() => held.promise)
  await vi.advanceTimersByTimeAsync(16000)
  held.resolve()
  await vi.advanceTimersByTimeAsync(0)
  expect(a.moveToCompleted).not.toHaveBeenCalled()
  renewal.resolve()
  expect(await run).toEqual({ processed: 1, failed: 0 })
  await vi.advanceTimersByTimeAsync(35000)
  expect(a.extendLock).toHaveBeenCalledOnce()
})

it('keeps renewing throughout a delayed ACK longer than the initial lease', async () => {
  const a = job()
  const held = deferred()
  const w = worker([a])
  a.moveToCompleted.mockReturnValue(held.promise)
  const run = observe(start(async () => {}))
  await vi.advanceTimersByTimeAsync(35000)
  expect(a.extendLock).toHaveBeenCalledTimes(2)
  expect(w.close).not.toHaveBeenCalled()
  expect(run.settled()).toBe(false)
  held.resolve()
  expect(await run.result).toEqual({
    ok: true,
    value: { processed: 1, failed: 0 },
  })
})

it.each([0, undefined, new Error('renewal during ACK')])(
  'ignores provisional renewal %s only after successful ACK',
  async error => {
    const a = job()
    const held = deferred()
    worker([a])
    a.moveToCompleted.mockReturnValue(held.promise)
    a.extendLock.mockImplementation(async () => {
      if (error === 0) {
        return 0
      }
      throw error
    })
    const run = observe(start(async () => {}))
    await vi.advanceTimersByTimeAsync(35000)
    expect(a.extendLock).toHaveBeenCalledTimes(2)
    expect(run.settled()).toBe(false)
    held.resolve()
    expect(await run.result).toEqual({
      ok: true,
      value: { processed: 1, failed: 0 },
    })
  },
)

it('preserves provisional undefined renewal failure when ACK subsequently rejects', async () => {
  const a = job()
  const held = deferred()
  worker([a])
  a.moveToCompleted.mockImplementation(async () => {
    await held.promise
    throw new Error('ACK')
  })
  a.extendLock.mockRejectedValue(undefined)
  const run = observe(start(async () => {}))
  await vi.advanceTimersByTimeAsync(16000)
  held.resolve()
  expect(await run.result).toEqual({ ok: false, error: undefined })
})

it('does not mask pre-ACK renewal failure with a successful sibling ACK', async () => {
  const a = job()
  const b = job()
  const held = deferred()
  const error = new Error('before ACK')
  worker([a, b])
  a.extendLock.mockRejectedValue(error)
  const run = observe(start(() => held.promise, 2))
  await vi.advanceTimersByTimeAsync(16000)
  held.resolve()
  expect(await run.result).toEqual({ ok: false, error })
  expect(b.moveToCompleted).toHaveBeenCalledOnce()
})

it('schedules renewal from attempt start rather than delayed response', async () => {
  const a = job()
  const held = deferred()
  const response = deferred()
  worker([a])
  a.extendLock.mockImplementationOnce(async () => {
    await response.promise
    return 1
  })
  const run = start(() => held.promise)
  await vi.advanceTimersByTimeAsync(35000)
  expect(a.extendLock).toHaveBeenCalledOnce()
  // Renewal applied at 15s, response arrives at 35s; lease expires at 45s.
  response.resolve()
  await vi.advanceTimersByTimeAsync(1)
  expect(a.extendLock).toHaveBeenCalledTimes(2)
  held.resolve()
  expect(await run).toEqual({ processed: 1, failed: 0 })
})

it('does not start a queued handler after its lease became uncertain', async () => {
  const a = job()
  const b = job()
  const held = deferred()
  const error = new Error('queued lease lost')
  worker([a, b])
  b.extendLock.mockRejectedValue(error)
  const handle = vi.fn(() => held.promise)
  const run = observe(start(handle, 2))
  await vi.advanceTimersByTimeAsync(16000)
  held.resolve()
  expect(await run.result).toEqual({ ok: false, error })
  expect(handle).toHaveBeenCalledOnce()
  expect(a.moveToCompleted).toHaveBeenCalledOnce()
  expect(b.moveToCompleted).not.toHaveBeenCalled()
})

it.each([false, true])(
  'retains the handler-failure warning after successful ACK, even if logging throws=%s',
  async throws => {
    const a = job()
    const held = deferred()
    const error = new Error('handler message')
    worker([a])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      if (throws) {
        throw new Error('logger')
      }
    })
    a.moveToFailed.mockReturnValue(held.promise)
    const run = start(async () => {
      throw error
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(warn).not.toHaveBeenCalled()
    held.resolve()
    expect(await run).toEqual({ processed: 0, failed: 1 })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('handler message'),
    )
  },
)

it('normalizes unprintable handler rejection without abandoning later admitted chunks', async () => {
  const a = job()
  const b = job()
  const held = deferred()
  const w = worker([a, b])
  const handle = vi
    .fn()
    .mockRejectedValueOnce({
      toString() {
        throw new Error('inspection')
      },
    })
    .mockImplementationOnce(() => held.promise)
  const run = observe(start(handle, 2))
  await vi.advanceTimersByTimeAsync(0)
  expect(handle).toHaveBeenCalledTimes(2)
  expect(w.close).not.toHaveBeenCalled()
  held.resolve()
  expect(await run.result).toEqual({
    ok: true,
    value: { processed: 1, failed: 1 },
  })
  expect(a.moveToFailed).toHaveBeenCalledWith(
    new Error('Task handler failed with an unprintable rejection'),
    expect.any(String),
    false,
  )
})

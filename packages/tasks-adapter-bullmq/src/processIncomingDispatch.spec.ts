/**
 * Tests for processIncomingDispatch race condition fix.
 *
 * Uses a real Redis testcontainer (started by setup.ts globalSetup).
 *
 * The bug: processIncomingDispatch creates a temp Worker and immediately calls
 * getNextJob() before the Worker's ioredis connection is ready. This causes
 * getNextJob to hang indefinitely or silently return null.
 *
 * The fix: call `await tempWorker.waitUntilReady()` before `getNextJob()`.
 *
 * Run: npx vitest run ./src/processIncomingDispatch.spec.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

const globalData = getGlobalData()
const REDIS_HOST = globalData.host || 'localhost'
const REDIS_PORT = globalData.port || 6379
const TEST_PREFIX = `test:dispatch:${Date.now()}`

describe('processIncomingDispatch', () => {
  let connector: BullMQConnector

  beforeAll(() => {
    connector = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
      },
      prefix: TEST_PREFIX,
    })
  })

  afterAll(async () => {
    await connector.close()
  })

  it('should pick up a job that was enqueued before dispatch is called', async () => {
    const queueName = 'dispatch_race_test'
    const jobData = { value: 'hello-from-race-test' }

    await connector.addJob(queueName, 'test-job', jobData)

    const counts = await connector.getJobCounts(queueName)
    expect(counts.waiting).toBe(1)

    let processedData: unknown = null
    const result = await connector.processIncomingDispatch({
      handleTask: async (_name, data) => {
        processedData = data
        return { ok: true }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queueName]),
      hint: { queueName },
    })

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
    expect(processedData).toEqual(jobData)

    const countsAfter = await connector.getJobCounts(queueName)
    expect(countsAfter.waiting).toBe(0)
  })

  it('should process multiple jobs across queues in one dispatch call', async () => {
    const queue1 = 'dispatch_multi_q1'
    const queue2 = 'dispatch_multi_q2'

    await connector.addJob(queue1, 'job-a', { q: 1 })
    await connector.addJob(queue2, 'job-b', { q: 2 })

    const processed: string[] = []
    const result = await connector.processIncomingDispatch({
      handleTask: async (name, _data) => {
        processed.push(name)
        return { ok: true }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queue1, queue2]),
    })

    expect(result.processed).toBe(2)
    expect(processed).toContain(queue1)
    expect(processed).toContain(queue2)
  })

  it('should return 0 processed when no jobs exist', async () => {
    const result = await connector.processIncomingDispatch({
      handleTask: async () => ({ ok: true }),
      timeBudgetMs: 5_000,
      validQueueNames: new Set(['empty_queue_test']),
    })

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)
  })

  // ── v2 parallel/batch behaviour tests ───────────────────────────────────

  it('processes a batch of jobs in parallel (handlers overlap in time)', async () => {
    const queueName = 'dispatch_parallel_test'
    const HANDLER_DELAY = 200
    const N = 20

    for (let i = 0; i < N; i++) {
      await connector.addJob(queueName, `job-${i}`, { i })
    }

    const startTimes: number[] = []
    const endTimes: number[] = []
    const result = await connector.processIncomingDispatch({
      handleTask: async () => {
        startTimes.push(Date.now())
        await new Promise(r => setTimeout(r, HANDLER_DELAY))
        endTimes.push(Date.now())
        return { ok: true }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queueName]),
      batchSize: N,
      concurrency: N,
    })

    expect(result.processed).toBe(N)
    expect(result.failed).toBe(0)

    // If processing were sequential, total wall time would be N * HANDLER_DELAY
    // (4000ms for N=20). With parallel batching it should be ~HANDLER_DELAY (200ms)
    // plus some overhead. Assert that all handlers started within 100ms of each other —
    // proves true parallelism, not interleaved sequential execution.
    const minStart = Math.min(...startTimes)
    const maxStart = Math.max(...startTimes)
    expect(maxStart - minStart).toBeLessThan(100)
  }, 15_000)

  it('respects concurrency cap when batchSize > concurrency', async () => {
    const queueName = 'dispatch_concurrency_cap_test'
    const N = 10
    const CONCURRENCY = 3
    const HANDLER_DELAY = 100

    for (let i = 0; i < N; i++) {
      await connector.addJob(queueName, `job-${i}`, { i })
    }

    let inFlight = 0
    let maxInFlight = 0
    const result = await connector.processIncomingDispatch({
      handleTask: async () => {
        inFlight++
        if (inFlight > maxInFlight) maxInFlight = inFlight
        await new Promise(r => setTimeout(r, HANDLER_DELAY))
        inFlight--
        return { ok: true }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queueName]),
      batchSize: N,
      concurrency: CONCURRENCY,
    })

    expect(result.processed).toBe(N)
    expect(maxInFlight).toBeLessThanOrEqual(CONCURRENCY)
    expect(maxInFlight).toBeGreaterThan(1) // proves we actually parallelized
  }, 15_000)

  it('one failing handler does not abort the batch (other jobs still ack)', async () => {
    const queueName = 'dispatch_partial_failure_test'
    const N = 5

    for (let i = 0; i < N; i++) {
      await connector.addJob(queueName, `job-${i}`, { i })
    }

    let attempts = 0
    const result = await connector.processIncomingDispatch({
      handleTask: async (_name, data) => {
        attempts++
        const i = (data as { i: number }).i
        if (i === 2) throw new Error('boom')
        return { ok: true, i }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queueName]),
      batchSize: N,
      concurrency: N,
    })

    expect(attempts).toBe(N) // all handlers ran
    expect(result.processed).toBe(N - 1)
    expect(result.failed).toBe(1)
  }, 10_000)

  it('drains queue across multiple inner iterations when total > batchSize', async () => {
    const queueName = 'dispatch_multi_batch_test'
    const N = 25
    const BATCH = 10

    for (let i = 0; i < N; i++) {
      await connector.addJob(queueName, `job-${i}`, { i })
    }

    const seen = new Set<number>()
    const result = await connector.processIncomingDispatch({
      handleTask: async (_name, data) => {
        seen.add((data as { i: number }).i)
        return { ok: true }
      },
      timeBudgetMs: 10_000,
      validQueueNames: new Set([queueName]),
      batchSize: BATCH,
      concurrency: BATCH,
    })

    expect(result.processed).toBe(N)
    expect(result.failed).toBe(0)
    expect(seen.size).toBe(N)
    // Confirm no double-delivery (BullMQ getNextJob is atomic; parallel calls
    // should never return the same job twice)
    for (let i = 0; i < N; i++) {
      expect(seen.has(i)).toBe(true)
    }
  }, 10_000)

  it('default batchSize=50 — backwards compatible at low load (1 job)', async () => {
    // Critical regression test: existing sodium tasks shouldn't see any
    // behaviour change when the queue only has 1 job.
    const queueName = 'dispatch_backwards_compat_test'
    await connector.addJob(queueName, 'lone-job', { only: true })

    let saw: unknown = null
    const result = await connector.processIncomingDispatch({
      handleTask: async (_name, data) => {
        saw = data
        return { ok: true }
      },
      timeBudgetMs: 5_000,
      validQueueNames: new Set([queueName]),
      // No batchSize passed — uses default 50
    })

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
    expect(saw).toEqual({ only: true })
  }, 10_000)

  it('should fail fast with bad credentials instead of hanging', async () => {
    const badConnector = new BullMQConnector({
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: 'wrong-password-intentionally',
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      },
      prefix: TEST_PREFIX,
    })

    try {
      await expect(
        badConnector.processIncomingDispatch({
          handleTask: async () => ({ ok: true }),
          timeBudgetMs: 5_000,
          validQueueNames: new Set(['should_not_reach']),
        }),
      ).rejects.toThrow()
    } finally {
      await badConnector.close().catch(() => {})
    }
  }, 15_000)
})

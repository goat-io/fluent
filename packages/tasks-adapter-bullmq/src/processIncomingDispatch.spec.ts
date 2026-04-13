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

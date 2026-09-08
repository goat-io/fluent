// pnpm exec vitest run src/global-close.redis.spec.ts
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import Redis from 'ioredis'
import { expect, it } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

it('global close joins a long dispatch and its follow-up enqueue before releasing queues', async () => {
  const { host, port } = getGlobalData()
  const connector = new BullMQConnector({
    connection: { host, port, maxRetriesPerRequest: null },
    prefix: `global-close-${randomUUID()}`,
  })
  const queueName = `held-${randomUUID()}`
  const queue = connector.getQueue(queueName)
  const observer = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  })
  let enter!: () => void
  const entered = new Promise<void>(resolve => {
    enter = resolve
  })
  let release!: () => void
  const held = new Promise<void>(resolve => {
    release = resolve
  })
  let dispatch: Promise<{ processed: number; failed: number }> | undefined
  let close: Promise<void> | undefined
  let closed = false
  let failed = false
  let failure: unknown
  let followupId: string | undefined
  try {
    await observer.connect()
    const original = await connector.addJob(queueName, 'original', {})
    dispatch = connector.processIncomingDispatch({
      validQueueNames: new Set([queueName]),
      batchSize: 1,
      concurrency: 1,
      timeBudgetMs: 5000,
      handleTask: async () => {
        enter()
        await held
        const followup = await connector.addJob(queueName, 'followup', {})
        followupId = followup.id
        return { completed: true }
      },
    })
    const outcome = dispatch.then(
      value => ({ ok: true as const, value }),
      error => ({ ok: false as const, error }),
    )
    await Promise.race([
      entered,
      outcome.then(result => {
        if (result.ok === false) {
          throw result.error
        }
        throw new Error('Dispatch settled before handler entry')
      }),
    ])
    const lockKey = `${queue.toKey(original.id!)}:lock`
    const initialTtl = await observer.pttl(lockKey)
    expect(initialTtl).toBeGreaterThan(0)
    expect(initialTtl).toBeLessThanOrEqual(30000)
    close = connector.close()
    void close.then(
      () => {
        closed = true
      },
      () => {
        closed = true
      },
    )
    const started = performance.now()
    await delay(35000)
    const heldMs = Math.round(performance.now() - started)
    const renewedTtl = await observer.pttl(lockKey)
    console.info(
      { heldMs, initialTtl, renewedTtl, closed },
      'real Redis global-close dispatch evidence',
    )
    expect(heldMs).toBeGreaterThanOrEqual(35000)
    expect(closed).toBe(false)
    expect(renewedTtl).toBeGreaterThan(0)
    expect(await observer.lrange(queue.toKey('active'), 0, -1)).toContain(
      original.id,
    )
    release()
    expect(await dispatch).toEqual({ processed: 1, failed: 0 })
    await close
    // Independent Redis reads remain valid after the connector closes its
    // owned client. Completion and durable follow-up are broker state, not
    // assertions against a closed Queue object.
    expect(
      await observer.zscore(queue.toKey('completed'), original.id!),
    ).not.toBeNull()
    expect(followupId).toBeTruthy()
    expect(await observer.lrange(queue.toKey('wait'), 0, -1)).toContain(
      followupId,
    )
    expect(await observer.pttl(lockKey)).toBe(-2)
  } catch (error) {
    failed = true
    failure = error
  } finally {
    release()
    try {
      try {
        await dispatch
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
      try {
        await (close ?? connector.close())
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
    } finally {
      observer.disconnect()
    }
  }
  if (failed) {
    throw failure
  }
}, 75000)

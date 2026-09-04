// pnpm exec vitest run src/shutdown.redis.spec.ts
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import Redis from 'ioredis'
import { expect, it } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

function barrier() {
  let release!: () => void
  const promise = new Promise<void>(resolve => {
    release = resolve
  })
  return { promise, release }
}

it('renews locks and preserves follow-up enqueue until the paused listener acknowledges its held job', async () => {
  const { host, port } = getGlobalData()
  expect(host).toBeTruthy()
  expect(port).toBeGreaterThan(0)
  const connector = new BullMQConnector({
    connection: { host, port, maxRetriesPerRequest: null },
    prefix: `shutdown-${randomUUID()}`,
  })
  const queueName = `held-${randomUUID()}`
  const queue = connector.getQueue(queueName)
  const entered = barrier()
  const allowEnqueue = barrier()
  const enqueued = barrier()
  const allowReturn = barrier()
  let handled = 0
  let followupId: string | undefined
  let stop: Promise<void> | undefined
  let stopped = false
  const listener = await connector.listen({
    tasks: [
      {
        taskName: queueName,
        concurrency: 1,
        handle: async () => {
          handled++
          entered.release()
          await allowEnqueue.promise
          const followup = await connector.addJob(queueName, 'follow-up', {
            followup: true,
          })
          followupId = followup.id
          enqueued.release()
          await allowReturn.promise
          return { completed: true }
        },
      },
    ],
  })
  // Independent observation connection, not BullMQ's version-specific client
  // facade. Its health does not establish producer/connector health.
  const observer = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
  })
  try {
    await observer.connect()
    const original = await connector.addJob(queueName, 'original', {
      original: true,
    })
    await entered.promise
    expect(await original.getState()).toBe('active')
    const lockKey = `${queue.toKey(original.id!)}:lock`
    const initialTtl = await observer.pttl(lockKey)
    expect(initialTtl).toBeGreaterThan(0)
    expect(initialTtl).toBeLessThanOrEqual(30_000)
    const started = performance.now()
    stop = listener.stop()
    void stop.then(
      () => {
        stopped = true
      },
      () => {
        stopped = true
      },
    )
    expect(listener.isRunning()).toBe(false)
    // The installed BullMQ default lock is 30s. A still-positive TTL after
    // 35s demonstrates renewal while pause(false) waits for the active job.
    await delay(35_000)
    expect(performance.now() - started).toBeGreaterThanOrEqual(35_000)
    expect(stopped).toBe(false)
    expect(await original.getState()).toBe('active')
    const renewedTtl = await observer.pttl(lockKey)
    expect(renewedTtl).toBeGreaterThan(0)

    allowEnqueue.release()
    await enqueued.promise
    expect(stopped).toBe(false)
    expect(followupId).toBeTruthy()
    const followup = await queue.getJob(followupId!)
    expect(await followup!.getState()).toBe('waiting')
    allowReturn.release()
    await stop
    expect(await original.getState()).toBe('completed')
    expect((await queue.getJob(original.id!))!.returnvalue).toEqual({
      completed: true,
    })
    expect(await followup!.getState()).toBe('waiting')
    expect(handled).toBe(1)
    expect(await observer.pttl(lockKey)).toBe(-2)
    // A real write after stop proves the connector's queues/shared producer
    // connection remain usable; pinging the observer would not prove that.
    const afterStop = await connector.addJob(queueName, 'after-stop', {
      afterStop: true,
    })
    expect(await afterStop.getState()).toBe('waiting')
    expect(handled).toBe(1)
    console.info(
      {
        heldMs: Math.round(performance.now() - started),
        initialTtl,
        renewedTtl,
        handled,
      },
      'real Redis listener drain evidence',
    )
  } finally {
    allowEnqueue.release()
    allowReturn.release()
    try {
      // No global close until this exact listener has proved successful drain.
      await (stop ?? listener.stop())
      await connector.close()
    } finally {
      observer.disconnect()
    }
  }
}, 75_000)

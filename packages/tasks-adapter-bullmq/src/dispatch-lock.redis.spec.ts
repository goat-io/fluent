// pnpm exec vitest run src/dispatch-lock.redis.spec.ts
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import { Job } from 'bullmq'
import Redis from 'ioredis'
import { expect, it, vi } from 'vitest'
import { BullMQConnector } from './BullMQConnector.js'
import { getGlobalData } from './test/const.js'

it.each(['handler', 'ACK'])(
  'retains a manual dispatch lock through %s longer than its initial lease',
  async phase => {
    const { host, port } = getGlobalData()
    const connector = new BullMQConnector({
      connection: { host, port, maxRetriesPerRequest: null },
      prefix: `dispatch-lock-${randomUUID()}`,
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
    let failed = false
    let failure: unknown
    const realAck = Job.prototype.moveToCompleted
    // Delay only submission of this job's real atomic ACK. No fake Redis or
    // altered lock duration: the job remains active throughout this barrier.
    const ack =
      phase === 'ACK'
        ? vi
            .spyOn(Job.prototype, 'moveToCompleted')
            .mockImplementation(async function (this: Job, ...args) {
              if (this.queueName === queueName) {
                enter()
                await held
              }
              return realAck.apply(this, args)
            })
        : undefined
    try {
      await observer.connect()
      const original = await connector.addJob(queueName, 'original', {})
      dispatch = connector.processIncomingDispatch({
        validQueueNames: new Set([queueName]),
        batchSize: 1,
        concurrency: 1,
        timeBudgetMs: 5000,
        handleTask: async () => {
          if (phase === 'handler') {
            enter()
            await held
          }
          return { completed: true }
        },
      })
      // Observe immediately, including an early pull failure before entry.
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
      expect(initialTtl).toBeLessThanOrEqual(30_000)
      const started = performance.now()
      await delay(35_000)
      const heldMs = Math.round(performance.now() - started)
      const renewedTtl = await observer.pttl(lockKey)
      const stateWhileHeld = await original.getState()
      release()
      const result = await dispatch
      const finalState = await original.getState()
      console.info(
        {
          phase,
          heldMs,
          initialTtl,
          renewedTtl,
          stateWhileHeld,
          result,
          finalState,
        },
        'real Redis manual dispatch lock evidence',
      )
      expect(heldMs).toBeGreaterThanOrEqual(35_000)
      expect.soft(renewedTtl).toBeGreaterThan(0)
      expect.soft(stateWhileHeld).toBe('active')
      expect.soft(result).toEqual({ processed: 1, failed: 0 })
      expect.soft(finalState).toBe('completed')
    } catch (error) {
      failed = true
      failure = error
    } finally {
      release()
      try {
        // Join this exact dispatch before closing any shared queue/connection.
        try {
          await dispatch
        } catch (error) {
          if (!failed) {
            failed = true
            failure = error
          }
        }
        await connector.close()
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      } finally {
        ack?.mockRestore()
        observer.disconnect()
      }
    }
    if (failed) {
      throw failure
    }
  },
  75_000,
)

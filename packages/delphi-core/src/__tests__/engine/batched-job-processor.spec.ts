// Unit tests for the BatchedJobProcessor primitive — the shared core of
// IngestWorker and StepStatusBuffer. Pure-function tests, no PG/Redis.
//
// npx vitest run src/__tests__/engine/batched-job-processor.spec.ts

import { describe, expect, it } from 'vitest'
import { BatchedJobProcessor } from '../../engine/BatchedJobProcessor.js'

describe('BatchedJobProcessor', () => {
  it('resolves enqueue() with the corresponding result from flushBatch', async () => {
    const p = new BatchedJobProcessor<number, string>({
      flushBatch: async jobs => jobs.map(j => `result-${j}`),
      flushThreshold: 3,
      flushIntervalMs: 1000,
    })
    const [r1, r2, r3] = await Promise.all([
      p.enqueue(1),
      p.enqueue(2),
      p.enqueue(3), // hits threshold → flushes
    ])
    expect([r1, r2, r3]).toEqual(['result-1', 'result-2', 'result-3'])
  })

  it('flushes on interval when threshold not reached', async () => {
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => jobs.map(j => j * 10),
      flushThreshold: 100, // not going to hit it
      flushIntervalMs: 30, // will hit this first
    })
    const result = await p.enqueue(5)
    expect(result).toBe(50)
  })

  it('rejects all per-job promises if flushBatch throws', async () => {
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async () => {
        throw new Error('boom')
      },
      flushThreshold: 2,
      flushIntervalMs: 1000,
    })
    const r1 = p.enqueue(1)
    const r2 = p.enqueue(2)
    await expect(r1).rejects.toThrow('boom')
    await expect(r2).rejects.toThrow('boom')
  })

  it('rejects with helpful error if flushBatch returns wrong-sized array', async () => {
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async () => [1], // returned 1 result for batch of 2
      flushThreshold: 2,
      flushIntervalMs: 1000,
    })
    const r1 = p.enqueue(10)
    const r2 = p.enqueue(20)
    await expect(r1).rejects.toThrow(/returned 1 results for 2 jobs/)
    await expect(r2).rejects.toThrow(/returned 1 results for 2 jobs/)
  })

  it('respects maxConcurrentFlushes cap', async () => {
    let inFlight = 0
    let maxObserved = 0
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => {
        inFlight++
        if (inFlight > maxObserved) {
          maxObserved = inFlight
        }
        await new Promise(r => setTimeout(r, 50))
        inFlight--
        return jobs
      },
      flushThreshold: 1, // each enqueue triggers a flush
      flushIntervalMs: 5,
      maxConcurrentFlushes: 2,
    })

    // Fire 10 in parallel — without the cap, all 10 flushes would overlap
    await Promise.all(Array.from({ length: 10 }, (_, i) => p.enqueue(i)))
    expect(maxObserved).toBeLessThanOrEqual(2)
    expect(maxObserved).toBeGreaterThan(1) // proves we actually parallelize
  })

  it('shutdown drains remaining pending items', async () => {
    let flushed = 0
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => {
        flushed += jobs.length
        return jobs
      },
      flushThreshold: 1000,
      flushIntervalMs: 5000,
    })
    p.enqueue(1)
    p.enqueue(2)
    p.enqueue(3)
    expect(flushed).toBe(0) // not flushed yet
    await p.shutdown()
    expect(flushed).toBe(3)
  })

  it('enqueue after shutdown rejects', async () => {
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => jobs,
    })
    await p.shutdown()
    await expect(p.enqueue(1)).rejects.toThrow(/shutting down/)
  })

  it('pendingCount reflects in-buffer items', async () => {
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => jobs,
      flushThreshold: 100,
      flushIntervalMs: 5000,
    })
    p.enqueue(1)
    p.enqueue(2)
    expect(p.pendingCount()).toBe(2)
    await p.shutdown()
  })

  it('handles multiple successive batches independently', async () => {
    const seenBatches: number[][] = []
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => {
        seenBatches.push([...jobs])
        return jobs
      },
      flushThreshold: 3,
      flushIntervalMs: 10,
    })

    // First batch
    await Promise.all([p.enqueue(1), p.enqueue(2), p.enqueue(3)])
    // Second batch
    await Promise.all([p.enqueue(4), p.enqueue(5), p.enqueue(6)])

    expect(seenBatches).toHaveLength(2)
    expect(seenBatches[0]).toEqual([1, 2, 3])
    expect(seenBatches[1]).toEqual([4, 5, 6])
  })

  it('one slow flushBatch does not block subsequent enqueues from triggering', async () => {
    const events: string[] = []
    const p = new BatchedJobProcessor<number, number>({
      flushBatch: async jobs => {
        events.push(`flush-start-${jobs.join(',')}`)
        await new Promise(r => setTimeout(r, 100))
        events.push(`flush-end-${jobs.join(',')}`)
        return jobs
      },
      flushThreshold: 1,
      flushIntervalMs: 5,
      maxConcurrentFlushes: 5,
    })

    // Fire 3 — each triggers its own flush, all should run in parallel
    const t0 = Date.now()
    await Promise.all([p.enqueue(1), p.enqueue(2), p.enqueue(3)])
    const elapsed = Date.now() - t0

    // If serial: ~300ms. If parallel: ~100-150ms.
    expect(elapsed).toBeLessThan(250)
  })
})

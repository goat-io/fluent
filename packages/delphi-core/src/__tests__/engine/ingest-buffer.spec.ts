// Unit tests for IngestBuffer — covers both the buffered fast path and the
// committed path (durability='committed'). Engine and connector are mocked
// so this spec runs without testcontainers / Docker.
//
// npx vitest run src/__tests__/engine/ingest-buffer.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestBuffer } from '../../engine/IngestBuffer.js'
import type { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import type { WorkflowTriggerInput } from '../../workflow/WorkflowBuilder.types.js'

// Minimal engine stub — only startBatchCopy is invoked by the committed path.
function makeEngineStub(opts?: {
  onStartBatchCopy?: (
    triggers: WorkflowTriggerInput[],
    o?: { synchronousCommit?: boolean; checkIdempotency?: boolean },
  ) => Promise<Array<{ runId: string }>>
}): WorkflowEngine {
  const startBatchCopy = vi.fn(
    async (triggers: WorkflowTriggerInput[], o?: any) => {
      if (opts?.onStartBatchCopy) {
        return opts.onStartBatchCopy(triggers, o)
      }
      // Default: echo the runIds the buffer assigned (committed path always
      // pre-assigns runId before calling startBatchCopy).
      return triggers.map(t => ({ runId: t.runId! }))
    },
  )
  return { startBatchCopy } as unknown as WorkflowEngine
}

// Minimal raw-bulk-queue stub for the buffered path.
function makeQueueStub() {
  const addBulk = vi.fn(async (_jobs: unknown[]) => undefined)
  return { addBulk }
}

describe('IngestBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('buffered path (enqueue)', () => {
    it('returns runId + traceId synchronously without an engine', () => {
      const queue = makeQueueStub()
      const buf = new IngestBuffer({ queue })

      const { runId, traceId } = buf.enqueue({
        workflowName: 'fast',
        tenantId: 't',
        input: {},
      })

      expect(runId).toMatch(/^[A-Za-z0-9_-]{21}$/)
      expect(traceId).toMatch(/^[A-Za-z0-9_-]{21}$/)
      // No flush yet — addBulk only fires on threshold or interval
      expect(queue.addBulk).not.toHaveBeenCalled()
    })

    it('honors caller-supplied runId + traceId', () => {
      const queue = makeQueueStub()
      const buf = new IngestBuffer({ queue })

      const { runId, traceId } = buf.enqueue({
        workflowName: 'fast',
        tenantId: 't',
        input: {},
        runId: 'custom-run-id-aaa',
        traceId: 'custom-trace-id-aa',
      })

      expect(runId).toBe('custom-run-id-aaa')
      expect(traceId).toBe('custom-trace-id-aa')
    })
  })

  describe('committed path (enqueueCommitted)', () => {
    it('throws when no engine was passed at construction', async () => {
      const queue = makeQueueStub()
      const buf = new IngestBuffer({ queue })

      await expect(
        buf.enqueueCommitted({ workflowName: 'pay', tenantId: 't', input: {} }),
      ).rejects.toThrow(
        /requires IngestBuffer to be constructed with \{ engine \}/,
      )
    })

    it('resolves with runId + traceId AFTER engine.startBatchCopy resolves', async () => {
      const queue = makeQueueStub()
      const engine = makeEngineStub()
      const buf = new IngestBuffer({
        queue,
        engine,
        committedFlushIntervalMs: 5,
      })

      const promise = buf.enqueueCommitted({
        workflowName: 'pay',
        tenantId: 't',
        input: { amount: 100 },
      })

      // Drive the BatchedJobProcessor's flushIntervalMs timer
      await vi.advanceTimersByTimeAsync(10)
      const result = await promise

      expect(result.runId).toMatch(/^[A-Za-z0-9_-]{21}$/)
      expect(result.traceId).toMatch(/^[A-Za-z0-9_-]{21}$/)
      expect(engine.startBatchCopy as any).toHaveBeenCalledTimes(1)
    })

    it('passes synchronousCommit + checkIdempotency opts to the engine', async () => {
      const queue = makeQueueStub()
      const engine = makeEngineStub()
      const buf = new IngestBuffer({
        queue,
        engine,
        committedFlushIntervalMs: 5,
      })

      const promise = buf.enqueueCommitted({
        workflowName: 'pay',
        tenantId: 't',
        input: {},
        idempotencyKey: 'order-42',
      })
      await vi.advanceTimersByTimeAsync(10)
      await promise

      expect(engine.startBatchCopy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ idempotencyKey: 'order-42' }),
        ]),
        { synchronousCommit: true, checkIdempotency: true },
      )
    })

    it('batches concurrent enqueueCommitted calls into ONE flushBatch invocation', async () => {
      const queue = makeQueueStub()
      const engine = makeEngineStub()
      const buf = new IngestBuffer({
        queue,
        engine,
        committedFlushIntervalMs: 20,
        committedFlushThreshold: 100,
      })

      // Fire 25 concurrent committed enqueues — all under threshold, so they
      // should all wait for the timer and flush together as ONE batch.
      const promises = Array.from({ length: 25 }, (_, i) =>
        buf.enqueueCommitted({
          workflowName: 'pay',
          tenantId: 't',
          input: { i },
        }),
      )

      await vi.advanceTimersByTimeAsync(25)
      const results = await Promise.all(promises)

      expect(results).toHaveLength(25)
      expect(engine.startBatchCopy).toHaveBeenCalledTimes(1)
      const triggersArg = (engine.startBatchCopy as any).mock
        .calls[0][0] as unknown[]
      expect(triggersArg).toHaveLength(25)
    })

    it('rejects per-job promise when flushBatch throws', async () => {
      const queue = makeQueueStub()
      // Reject via Promise.reject instead of throw-inside-async — same
      // semantics for the BatchedJobProcessor catch but avoids a vitest
      // cosmetic "unhandled rejection" warning from the spy wrapper.
      const engine = makeEngineStub({
        onStartBatchCopy: () => Promise.reject(new Error('PG down')),
      })
      const buf = new IngestBuffer({
        queue,
        engine,
        committedFlushIntervalMs: 5,
        // Silence the BatchedJobProcessor's error log so test output is clean
        logger: { info: () => {}, error: () => {} },
      })

      const promise = buf.enqueueCommitted({
        workflowName: 'pay',
        tenantId: 't',
        input: {},
      })
      // Pre-attach the rejection handler so Node sees it before the timer fires
      const rejection = expect(promise).rejects.toThrow(/PG down/)
      await vi.advanceTimersByTimeAsync(10)
      await rejection
    })

    it('shutdown drains pending committed promises', async () => {
      const queue = makeQueueStub()
      const engine = makeEngineStub()
      const buf = new IngestBuffer({
        queue,
        engine,
        committedFlushIntervalMs: 1000, // long enough that timer wouldn't fire
      })

      const promise = buf.enqueueCommitted({
        workflowName: 'pay',
        tenantId: 't',
        input: {},
      })

      // Drain via shutdown — should resolve the pending committed promise
      vi.useRealTimers()
      await buf.shutdown()
      const result = await promise
      expect(result.runId).toBeDefined()
    })
  })
})

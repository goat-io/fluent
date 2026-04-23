// Queue-first workflow ingestion buffer.
// HTTP handlers call enqueue() → returns runId immediately.
// Buffer flushes triggers to BullMQ via addBulk (atomic Redis LUA).
// An IngestWorker on the other end drains batches into PG via COPY FROM.
//
// npx vitest run src/__tests__/engine/ingest-buffer.spec.ts

import type { TaskConnector } from '@goatlab/tasks-core'
import { nanoId } from '../db/ids.js'
import type { WorkflowTriggerInput } from '../workflow/WorkflowBuilder.types.js'
import { BatchedJobProcessor } from './BatchedJobProcessor.js'
import type { WorkflowEngine } from './WorkflowEngine.js'

/**
 * Minimal "raw bulk queue" shape — covers BullMQ's Queue.addBulk and any
 * other backend that exposes a similar primitive. Caller can pass either:
 *   - a TaskConnector (preferred, backend-agnostic — uses bulkQueue if
 *     present, falls back to a queue() loop otherwise), or
 *   - a raw object with addBulk for backwards compat with the legacy
 *     `queue: connector.getQueue(...)` API.
 */
type RawBulkQueue = {
  addBulk: (
    jobs: Array<{
      name: string
      data: unknown
      opts?: Record<string, unknown>
    }>,
  ) => Promise<unknown>
}

export interface IngestBufferConfig {
  /**
   * Either:
   *  - `connector` + `taskName`: backend-agnostic path via TaskConnector.bulkQueue
   *    (recommended — works with BullMQ, GCP Tasks, Hatchet, etc.)
   *  - `queue`: legacy raw BullMQ Queue from `connector.getQueue('workflow_ingest')`
   *    (kept for backwards compat — only works against BullMQ)
   */
  connector?: TaskConnector<object>
  taskName?: string
  queue?: RawBulkQueue

  /** Flush when buffer reaches this size. Default: 100 */
  flushThreshold?: number
  /** Flush at least every N ms, with up to maxJitterMs of random jitter. Default: 50ms */
  flushIntervalMs?: number
  /** Random jitter added to flush interval to avoid thundering herd across N servers. Default: 20ms */
  maxJitterMs?: number
  /** BullMQ job name (default: 'ingest') */
  jobName?: string
  logger?: {
    info: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }

  /**
   * Optional engine reference. REQUIRED to use enqueueCommitted() — the
   * committed path bypasses BullMQ and calls engine.startBatchCopy() directly
   * from the HTTP process so the per-request promise can resolve only after
   * PG COMMIT. Buffered path ignores this field.
   */
  engine?: WorkflowEngine
  /** Committed-path flush threshold. Default: 100 */
  committedFlushThreshold?: number
  /** Committed-path flush interval. Default: 20ms (tighter than buffered — callers are blocked) */
  committedFlushIntervalMs?: number
  /** Max concurrent COPY FROM transactions from the HTTP process. Default: 4 */
  committedMaxConcurrentFlushes?: number
}

/**
 * Each buffered entry = one workflow start. runId is pre-assigned so
 * callers get it back synchronously and can poll /status right away.
 */
interface BufferedTrigger {
  runId: string
  trigger: WorkflowTriggerInput
}

export class IngestBuffer {
  private buffer: BufferedTrigger[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  private shuttingDown = false

  private readonly flushThreshold: number
  private readonly flushIntervalMs: number
  private readonly maxJitterMs: number
  private readonly jobName: string
  /** Backend-agnostic path: connector + taskName, uses bulkQueue if available */
  private readonly connector?: TaskConnector<object>
  private readonly taskName: string
  /** Legacy path: raw object with .addBulk (kept for backwards compat) */
  private readonly rawQueue?: RawBulkQueue
  private readonly logger?: IngestBufferConfig['logger']

  /**
   * Committed-durability processor. Present only when engine was provided.
   * Flushes directly via engine.startBatchCopy (bypassing BullMQ) so the
   * per-enqueue promise resolves only after PG COMMIT.
   */
  private readonly committedProcessor?: BatchedJobProcessor<
    { trigger: WorkflowTriggerInput; traceId: string },
    { runId: string; traceId: string }
  >

  constructor(config: IngestBufferConfig) {
    if (!config.connector && !config.queue) {
      throw new Error(
        'IngestBuffer requires either { connector + taskName } or { queue }',
      )
    }
    this.connector = config.connector
    this.taskName = config.taskName ?? 'workflow_ingest'
    this.rawQueue = config.queue
    this.flushThreshold = config.flushThreshold ?? 100
    this.flushIntervalMs = config.flushIntervalMs ?? 50
    this.maxJitterMs = config.maxJitterMs ?? 20
    this.jobName = config.jobName ?? 'ingest'
    this.logger = config.logger

    if (config.engine) {
      const engine = config.engine
      this.committedProcessor = new BatchedJobProcessor({
        name: 'IngestBuffer.committed',
        flushThreshold: config.committedFlushThreshold ?? 100,
        flushIntervalMs: config.committedFlushIntervalMs ?? 20,
        maxConcurrentFlushes: config.committedMaxConcurrentFlushes ?? 4,
        logger: config.logger
          ? { info: config.logger.info, error: config.logger.error }
          : undefined,
        flushBatch: async jobs => {
          const triggers = jobs.map(j => j.trigger)
          // synchronousCommit: true — committed workflows MUST survive a
          // power loss. COMMIT blocks until WAL fsync; BatchedJobProcessor
          // amortizes that fsync across every concurrent caller in the batch.
          //
          // checkIdempotency: true — committed flows are typically payment-
          // style (double-submit must NOT charge twice). One SELECT per tenant
          // before the COPY; deduped triggers return the original runId.
          const results = await engine.startBatchCopy(triggers, {
            synchronousCommit: true,
            checkIdempotency: true,
          })
          return results.map((r, i) => ({
            runId: r.runId,
            traceId: jobs[i]!.traceId,
          }))
        },
      })
    }

    this.scheduleNext()
  }

  /**
   * Accept a trigger. Returns the assigned runId synchronously.
   * The trigger is buffered in-memory and will be flushed to BullMQ.
   * If the process crashes before flush, the request is lost (same risk profile
   * as the existing log buffer). Flush window is at most flushIntervalMs + jitter.
   */
  enqueue(trigger: WorkflowTriggerInput): { runId: string; traceId: string } {
    if (this.shuttingDown) {
      throw new Error(
        'IngestBuffer is shutting down; not accepting new triggers',
      )
    }
    const runId = trigger.runId ?? nanoId(21)
    // Assign traceId at the HTTP boundary so callers can correlate distributed
    // spans before the COPY FROM commits. Mirrors the engine's own default.
    const traceId = trigger.traceId ?? nanoId(21)
    this.buffer.push({ runId, trigger: { ...trigger, runId, traceId } })

    if (this.buffer.length >= this.flushThreshold) {
      void this.flush()
    }
    return { runId, traceId }
  }

  /**
   * Accept a trigger with 'committed' durability. Returns a promise that
   * resolves ONLY after the workflow_runs row has been COPY-FROM'd and
   * COMMIT'd to Postgres. Throughput stays high because concurrent committed
   * requests share a COPY transaction via BatchedJobProcessor — each caller
   * just waits one flush window (~20ms) + COPY time (~10-30ms).
   *
   * Requires `engine` to have been passed in config. Throws otherwise.
   */
  async enqueueCommitted(
    trigger: WorkflowTriggerInput,
  ): Promise<{ runId: string; traceId: string }> {
    if (this.shuttingDown) {
      throw new Error(
        'IngestBuffer is shutting down; not accepting new triggers',
      )
    }
    if (!this.committedProcessor) {
      throw new Error(
        'enqueueCommitted requires IngestBuffer to be constructed with { engine }',
      )
    }
    const runId = trigger.runId ?? nanoId(21)
    const traceId = trigger.traceId ?? nanoId(21)
    return this.committedProcessor.enqueue({
      trigger: { ...trigger, runId, traceId },
      traceId,
    })
  }

  /** Force a flush now (e.g. on graceful shutdown). */
  async flushNow(): Promise<void> {
    await this.flush()
    if (this.committedProcessor) {
      await this.committedProcessor.flushNow()
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
    if (this.committedProcessor) {
      await this.committedProcessor.shutdown()
    }
  }

  currentDepth(): number {
    return this.buffer.length
  }

  private scheduleNext(): void {
    if (this.shuttingDown) {
      return
    }
    const jitter = Math.floor(Math.random() * this.maxJitterMs)
    this.timer = setTimeout(() => {
      void this.flush().finally(() => this.scheduleNext())
    }, this.flushIntervalMs + jitter)
  }

  private async flush(): Promise<void> {
    if (this.flushing) {
      return
    }
    if (this.buffer.length === 0) {
      return
    }
    this.flushing = true

    // Atomic swap — isolate the batch we're about to ship
    const batch = this.buffer
    this.buffer = []

    try {
      // Backend-agnostic path — TaskConnector.bulkQueue (BullMQ uses
      // addBulk under the hood; other adapters fall back to a queue() loop)
      if (this.connector) {
        if (typeof this.connector.bulkQueue === 'function') {
          await this.connector.bulkQueue(
            batch.map(b => ({
              uniqueTaskName: `ingest-${b.runId}`,
              taskName: this.taskName,
              taskBody: { runId: b.runId, trigger: b.trigger } as object,
              opts: { removeOnComplete: true, removeOnFail: 100 },
            })),
          )
        } else {
          // Backend without bulkQueue — fall back to per-job queue() calls
          await Promise.all(
            batch.map(b =>
              this.connector!.queue({
                uniqueTaskName: `ingest-${b.runId}`,
                taskName: this.taskName,
                postUrl: '/noop',
                taskBody: { runId: b.runId, trigger: b.trigger } as object,
                handle: async () => {},
              }),
            ),
          )
        }
      } else if (this.rawQueue) {
        // Legacy path — raw BullMQ Queue.addBulk
        await this.rawQueue.addBulk(
          batch.map(b => ({
            name: this.jobName,
            data: { runId: b.runId, trigger: b.trigger },
            opts: {
              jobId: `ingest-${b.runId}`,
              removeOnComplete: true,
              removeOnFail: 100,
            },
          })),
        )
      }
    } catch (err) {
      // Re-prepend on failure so we don't drop requests (same pattern as log buffer)
      this.buffer.unshift(...batch)
      this.logger?.error('IngestBuffer.flush failed; re-prepended', err)
    } finally {
      this.flushing = false
    }
  }
}

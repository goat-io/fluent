// Queue-first workflow ingestion buffer.
// HTTP handlers call enqueue() → returns runId immediately.
// Buffer flushes triggers to BullMQ via addBulk (atomic Redis LUA).
// An IngestWorker on the other end drains batches into PG via COPY FROM.
//
// npx vitest run src/__tests__/engine/ingest-buffer.spec.ts

import { Ids } from '@goatlab/js-utils'
import type { WorkflowTriggerInput } from '../workflow/WorkflowBuilder.types.js'

export interface IngestBufferConfig {
  /** BullMQ Queue instance (from connector.getQueue('workflow_ingest')) */
  queue: {
    addBulk: (jobs: Array<{ name: string; data: unknown; opts?: Record<string, unknown> }>) => Promise<unknown>
  }
  /** Flush when buffer reaches this size. Default: 100 */
  flushThreshold?: number
  /** Flush at least every N ms, with up to maxJitterMs of random jitter. Default: 50ms */
  flushIntervalMs?: number
  /** Random jitter added to flush interval to avoid thundering herd across N servers. Default: 20ms */
  maxJitterMs?: number
  /** BullMQ job name (default: 'ingest') */
  jobName?: string
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
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
  private readonly queue: IngestBufferConfig['queue']
  private readonly logger?: IngestBufferConfig['logger']

  constructor(config: IngestBufferConfig) {
    this.queue = config.queue
    this.flushThreshold = config.flushThreshold ?? 100
    this.flushIntervalMs = config.flushIntervalMs ?? 50
    this.maxJitterMs = config.maxJitterMs ?? 20
    this.jobName = config.jobName ?? 'ingest'
    this.logger = config.logger
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
      throw new Error('IngestBuffer is shutting down; not accepting new triggers')
    }
    const runId = trigger.runId ?? Ids.nanoId(21)
    // Assign traceId at the HTTP boundary so callers can correlate distributed
    // spans before the COPY FROM commits. Mirrors the engine's own default.
    const traceId = trigger.traceId ?? Ids.nanoId(21)
    this.buffer.push({ runId, trigger: { ...trigger, runId, traceId } })

    if (this.buffer.length >= this.flushThreshold) {
      void this.flush()
    }
    return { runId, traceId }
  }

  /** Force a flush now (e.g. on graceful shutdown). */
  async flushNow(): Promise<void> {
    await this.flush()
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  currentDepth(): number {
    return this.buffer.length
  }

  private scheduleNext(): void {
    if (this.shuttingDown) return
    const jitter = Math.floor(Math.random() * this.maxJitterMs)
    this.timer = setTimeout(() => {
      void this.flush().finally(() => this.scheduleNext())
    }, this.flushIntervalMs + jitter)
  }

  private async flush(): Promise<void> {
    if (this.flushing) return
    if (this.buffer.length === 0) return
    this.flushing = true

    // Atomic swap — isolate the batch we're about to ship
    const batch = this.buffer
    this.buffer = []

    try {
      const jobs = batch.map(b => ({
        name: this.jobName,
        data: { runId: b.runId, trigger: b.trigger },
        opts: { jobId: `ingest-${b.runId}`, removeOnComplete: true, removeOnFail: 100 },
      }))
      await this.queue.addBulk(jobs)
    } catch (err) {
      // Re-prepend on failure so we don't drop requests (same pattern as log buffer)
      this.buffer.unshift(...batch)
      this.logger?.error('IngestBuffer.flush failed; re-prepended', err)
    } finally {
      this.flushing = false
    }
  }
}

// Worker-side accumulator for queue-first ingestion.
// BullMQ dispatches jobs one-by-one to the handler. We re-batch them here
// so N concurrent jobs turn into one COPY FROM transaction against PG.
//
// Design:
//  - handleJob() adds the job to a shared batch, waits on a promise
//  - a tick fires when the batch hits flushThreshold OR flushIntervalMs elapses
//  - tick calls engine.startBatchCopy(triggers) and resolves every waiter
//
// This preserves BullMQ's at-least-once + per-job ack semantics while
// collapsing N worker invocations into 1 PG transaction.

import type { WorkflowEngine } from './WorkflowEngine.js'
import type { WorkflowTriggerInput } from '../workflow/WorkflowBuilder.types.js'

export interface IngestWorkerConfig {
  engine: WorkflowEngine
  /** Max jobs per COPY batch. Default 100. */
  flushThreshold?: number
  /** Max ms to hold a job waiting for more. Default 20ms. */
  flushIntervalMs?: number
  /**
   * Max concurrent COPY-FROM transactions in flight.
   * Each flush checks out one PG pool client, so cap below pool size
   * to leave headroom for other engine queries. Default 8.
   */
  maxConcurrentFlushes?: number
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
}

interface PendingJob {
  trigger: WorkflowTriggerInput
  resolve: (runId: string) => void
  reject: (err: unknown) => void
}

export class IngestWorker {
  private pending: PendingJob[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = 0

  private readonly engine: WorkflowEngine
  private readonly flushThreshold: number
  private readonly flushIntervalMs: number
  private readonly maxConcurrentFlushes: number
  private readonly logger?: IngestWorkerConfig['logger']

  constructor(config: IngestWorkerConfig) {
    this.engine = config.engine
    this.flushThreshold = config.flushThreshold ?? 100
    this.flushIntervalMs = config.flushIntervalMs ?? 20
    this.maxConcurrentFlushes = config.maxConcurrentFlushes ?? 8
    this.logger = config.logger
  }

  /**
   * BullMQ handler. Job payload shape: { runId, trigger }.
   * Returns the runId once the COPY transaction commits (or throws on failure).
   * BullMQ will retry on rejection.
   */
  async handleJob(data: { runId: string; trigger: WorkflowTriggerInput }): Promise<{ runId: string }> {
    const trigger: WorkflowTriggerInput = { ...data.trigger, runId: data.runId }
    return new Promise<{ runId: string }>((resolve, reject) => {
      this.pending.push({
        trigger,
        resolve: (runId) => resolve({ runId }),
        reject,
      })

      if (this.pending.length >= this.flushThreshold) {
        this.triggerFlush()
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.triggerFlush(), this.flushIntervalMs)
      }
    })
  }

  private triggerFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // Fire-and-forget; errors are delivered to individual waiters
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.pending.length === 0) return
    if (this.inFlight >= this.maxConcurrentFlushes) return
    this.inFlight++

    // Atomic swap — this batch is owned by this flush call alone
    const batch = this.pending
    this.pending = []

    try {
      const triggers = batch.map(p => p.trigger)
      const results = await this.engine.startBatchCopy(triggers)
      // results[i].runId matches batch[i].trigger.runId by construction
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(results[i]!.runId)
      }
    } catch (err) {
      this.logger?.error('IngestWorker.flush failed; rejecting batch', err)
      for (const p of batch) p.reject(err)
    } finally {
      this.inFlight--
      // If pending grew past threshold while we were in-flight, kick another flush
      if (this.pending.length >= this.flushThreshold && this.inFlight < this.maxConcurrentFlushes) {
        void this.flush()
      }
    }
  }

  /** Flush any in-flight waiters (for graceful shutdown). */
  async drain(): Promise<void> {
    await this.flush()
  }

  pendingCount(): number {
    return this.pending.length
  }
}

// Worker-side accumulator for queue-first ingestion.
// BullMQ dispatches jobs one-by-one to the handler. We re-batch them here
// so N concurrent jobs turn into one COPY FROM transaction against PG.
//
// Implementation note: this class is now a thin wrapper around the generic
// BatchedJobProcessor primitive (per-job-promise + accumulator + flush).
// All the heavy lifting — atomic swap, threshold/interval triggers,
// bounded concurrent flushes, per-job promise resolution — lives in
// BatchedJobProcessor and is shared with StepStatusBuffer.

import type { WorkflowTriggerInput } from '../workflow/WorkflowBuilder.types.js'
import { BatchedJobProcessor } from './BatchedJobProcessor.js'
import type { WorkflowEngine } from './WorkflowEngine.js'

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
  logger?: {
    info?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
}

interface IngestJob {
  trigger: WorkflowTriggerInput
}

export class IngestWorker {
  private readonly engine: WorkflowEngine
  private readonly processor: BatchedJobProcessor<IngestJob, string>

  constructor(config: IngestWorkerConfig) {
    this.engine = config.engine
    this.processor = new BatchedJobProcessor<IngestJob, string>({
      name: 'IngestWorker',
      flushThreshold: config.flushThreshold ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 20,
      maxConcurrentFlushes: config.maxConcurrentFlushes ?? 8,
      logger: config.logger,
      flushBatch: async jobs => {
        const triggers = jobs.map(j => j.trigger)
        const results = await this.engine.startBatchCopy(triggers)
        // results[i].runId matches jobs[i].trigger.runId by construction
        return results.map(r => r.runId)
      },
    })
  }

  /**
   * BullMQ handler. Job payload shape: { runId, trigger }.
   * Returns the runId once the COPY transaction commits (or throws on failure).
   * BullMQ will retry on rejection.
   */
  async handleJob(data: {
    runId: string
    trigger: WorkflowTriggerInput
  }): Promise<{ runId: string }> {
    const trigger: WorkflowTriggerInput = { ...data.trigger, runId: data.runId }
    const runId = await this.processor.enqueue({ trigger })
    return { runId }
  }

  /** Flush any in-flight waiters (for graceful shutdown). */
  async drain(): Promise<void> {
    await this.processor.flushNow()
  }

  pendingCount(): number {
    return this.processor.pendingCount()
  }
}

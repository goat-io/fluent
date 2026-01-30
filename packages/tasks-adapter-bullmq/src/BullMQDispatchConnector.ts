import type { DispatchConnector, DispatchHint } from '@goatlab/tasks-core'
import type { ConnectionOptions } from 'bullmq'
import { Queue, Worker } from 'bullmq'

const DISPATCH_QUEUE_NAME = 'dispatch-hints'
const DISPATCH_PREFIX = 'dispatch'

export interface BullMQDispatchConnectorConfig {
  /** Redis connection for the dispatch queue (separate from tenant queues) */
  connection: ConnectionOptions
  /** Lua scripts instance for atomic counter operations */
  luaScripts: {
    incrementBacklog(delta?: number): Promise<number>
    decrementBacklog(delta?: number): Promise<number>
    getBacklog(): Promise<number>
    incrementInflight(count?: number): Promise<number>
    decrementInflight(): Promise<number>
    getInflight(): Promise<number>
    incrementZeroWorkStreak(): Promise<number>
    resetZeroWorkStreak(): Promise<void>
    getZeroWorkStreak(): Promise<number>
  }
  /**
   * Function to get a tenant's BullMQ Queue for manual job fetching.
   * The dispatch connector does NOT create tenant queues -- it asks the
   * caller to provide them. This keeps tenant Redis resolution external.
   */
  getTenantQueue: (tenantId: string, queueName: string) => Promise<Queue>
}

/**
 * BullMQ implementation of the provider-agnostic DispatchConnector.
 *
 * Uses a dedicated BullMQ Queue for dispatch hints (pointers to tenant jobs).
 * Supports priority-based ordering (BullMQ sorted sets).
 * Uses manual fetching (getNextJob) instead of blocking Workers.
 */
export class BullMQDispatchConnector implements DispatchConnector {
  private readonly dispatchQueue: Queue
  private dispatchWorker: Worker | null = null
  private readonly luaScripts: BullMQDispatchConnectorConfig['luaScripts']
  private readonly getTenantQueue: BullMQDispatchConnectorConfig['getTenantQueue']

  constructor(private readonly config: BullMQDispatchConnectorConfig) {
    this.luaScripts = config.luaScripts
    this.getTenantQueue = config.getTenantQueue

    this.dispatchQueue = new Queue(DISPATCH_QUEUE_NAME, {
      connection: config.connection,
      prefix: DISPATCH_PREFIX,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
      },
    })
  }

  /**
   * Write a dispatch hint to the global dispatch queue.
   * Idempotent: uses jobId for deduplication.
   */
  async writeHint(hint: DispatchHint): Promise<void> {
    const jobId = hint.jobId
      ? `${hint.tenantId}:${hint.queueName}:${hint.jobId}`
      : `${hint.tenantId}:${hint.queueName}:${hint.createdAt}`

    await this.dispatchQueue.add(
      'dispatch-hint',
      hint,
      {
        jobId,
        priority: hint.priority,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    )

    // Increment backlog counter
    await this.luaScripts.incrementBacklog()
  }

  /**
   * Fetch the next dispatch hint using BullMQ manual fetching.
   * Creates a lightweight Worker on first call for getNextJob() support.
   */
  async fetchNextHint(): Promise<DispatchHint | null> {
    if (!this.dispatchWorker) {
      this.dispatchWorker = new Worker(
        DISPATCH_QUEUE_NAME,
        undefined, // No processor -- manual fetching only
        {
          connection: this.config.connection,
          prefix: DISPATCH_PREFIX,
          autorun: false, // Don't auto-start processing
        },
      )
    }

    const job = await this.dispatchWorker.getNextJob('dispatch-fetcher')
    if (!job) return null

    const hint = job.data as DispatchHint

    // Move hint to completed (it's been consumed)
    await job.moveToCompleted('processed', job.token || '0', false)

    // Decrement backlog counter
    await this.luaScripts.decrementBacklog()

    return hint
  }

  /**
   * Process a single job from a tenant queue based on a dispatch hint.
   * Uses BullMQ's manual fetching to get the actual job, then calls the handler.
   */
  async processHint(
    hint: DispatchHint,
    handler: (tenantId: string, queueName: string, jobData: unknown) => Promise<unknown>,
  ): Promise<boolean> {
    // Get tenant queue (caller provides resolution logic)
    const tenantQueue = await this.getTenantQueue(hint.tenantId, hint.queueName)

    // Create a temporary worker for manual fetching from this tenant queue
    // NOTE: This does NOT create a persistent Worker -- it's just for getNextJob()
    const tempWorker = new Worker(
      hint.queueName,
      undefined,
      {
        connection: (tenantQueue as any).opts?.connection || this.config.connection,
        prefix: (tenantQueue as any).opts?.prefix,
        autorun: false,
      },
    )

    try {
      const job = await tempWorker.getNextJob('manual-dispatcher')
      if (!job) {
        // Job already processed or removed (hint was stale)
        await tempWorker.close()
        return false
      }

      try {
        const result = await handler(hint.tenantId, hint.queueName, job.data)
        await job.moveToCompleted(result, job.token || '0', false)
        return true
      } catch (error) {
        await job.moveToFailed(error as Error, job.token || '0', false)
        throw error
      }
    } finally {
      await tempWorker.close()
    }
  }

  async getBacklogSize(): Promise<number> {
    return this.luaScripts.getBacklog()
  }

  async getInflightCount(): Promise<number> {
    return this.luaScripts.getInflight()
  }

  async incrementInflight(count: number): Promise<void> {
    await this.luaScripts.incrementInflight(count)
  }

  async decrementInflight(): Promise<void> {
    await this.luaScripts.decrementInflight()
  }

  async incrementZeroWorkStreak(): Promise<number> {
    return this.luaScripts.incrementZeroWorkStreak()
  }

  async resetZeroWorkStreak(): Promise<void> {
    await this.luaScripts.resetZeroWorkStreak()
  }

  async close(): Promise<void> {
    if (this.dispatchWorker) {
      await this.dispatchWorker.close()
      this.dispatchWorker = null
    }
    await this.dispatchQueue.close()
  }
}

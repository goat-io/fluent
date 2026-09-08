/**
 * TaskTracker - Queue-agnostic task status tracking
 *
 * Provides high-throughput task tracking with:
 * - Buffered writes for 10K+ tasks/second
 * - Real-time updates via Pub/Sub
 * - Multi-tenant isolation
 *
 * Usage:
 * ```typescript
 * const tracker = new TaskTracker(redisConnector)
 *
 * // Create a task
 * await tracker.create('task-123', 'tenant-1', 'processOrder')
 *
 * // Update progress
 * await tracker.start('task-123', 'tenant-1')
 * await tracker.progress('task-123', 'tenant-1', 50, 'Processing items...')
 * await tracker.complete('task-123', 'tenant-1', { orderId: 'order-456' })
 *
 * // Subscribe to updates (for SSE)
 * const unsubscribe = tracker.subscribe('task-123', 'tenant-1', (state) => {
 *   console.log('Task updated:', state)
 * })
 * ```
 */

import { Ids } from '@goatlab/js-utils'
import { IngestBuffer } from './buffer/IngestBuffer'
import type { CreationReceipt, TrackerOutcome } from './TaskTracker.types'
import type {
  CreateTrackedTaskOptions,
  ListByOwnerOptions,
  ProgressOptions,
  TaskStateCallback,
  TaskTrackerConfig,
  TaskTrackerConnector,
  TrackedTaskState,
  Unsubscribe,
} from './tracker.types'

export class TaskTracker {
  private readonly connector: TaskTrackerConnector
  private readonly config: TaskTrackerConfig
  private readonly buffer: IngestBuffer<TrackedTaskState>
  private _isShutdown = false
  private readonly receipts = new WeakMap<TrackedTaskState, CreationReceipt>()
  private readonly pendingCreates = new Map<
    string,
    Map<string, Set<CreationReceipt>>
  >()
  private readonly operations = new Set<Promise<TrackerOutcome>>()
  private failureOrder = 0
  private shutdownPromise?: Promise<void>

  constructor(
    connector: TaskTrackerConnector,
    config?: Partial<TaskTrackerConfig>,
  ) {
    this.connector = connector
    this.config = {
      flushIntervalMs: config?.flushIntervalMs ?? 10,
      flushThreshold: config?.flushThreshold ?? 100,
      maxConcurrentFlushes: config?.maxConcurrentFlushes ?? 50,
      bufferStrategy: config?.bufferStrategy ?? 'DYNAMIC',
      completedTaskTTL: config?.completedTaskTTL ?? 86400,
      failedTaskTTL: config?.failedTaskTTL ?? 604800,
    }

    // Initialize buffer with connector's batch create
    this.buffer = new IngestBuffer(tasks => this.persistCreates(tasks), {
      flushIntervalMs: this.config.flushIntervalMs,
      flushThreshold: this.config.flushThreshold,
      maxConcurrent: this.config.maxConcurrentFlushes,
      strategy: this.config.bufferStrategy,
    })
  }

  private failure(error: unknown): TrackerOutcome {
    const order = this.failureOrder
    this.failureOrder = order + 1
    return { ok: false, error, order }
  }

  private own<T>(callback: () => Promise<T>): Promise<T> {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (error: unknown) => void
    const result = new Promise<T>((yes, no) => {
      resolve = yes
      reject = no
    })
    const outcome = result.then(
      () => {
        this.operations.delete(outcome)
        return { ok: true } as const
      },
      error => {
        this.operations.delete(outcome)
        return this.failure(error)
      },
    )
    this.operations.add(outcome)
    // Registration precedes getters and callbacks, including reentrant shutdown.
    try {
      resolve(callback())
    } catch (error) {
      reject(error)
    }
    return result
  }

  private receiptFor(state: TrackedTaskState): CreationReceipt {
    let settle!: (outcome: TrackerOutcome) => void
    const outcome = new Promise<TrackerOutcome>(resolve => {
      settle = resolve
    })
    const receipt = { outcome, settle, settled: false }
    this.receipts.set(state, receipt)
    let tenant = this.pendingCreates.get(state.tenantId)
    if (!tenant) {
      tenant = new Map()
      this.pendingCreates.set(state.tenantId, tenant)
    }
    let task = tenant.get(state.id)
    if (!task) {
      task = new Set()
      tenant.set(state.id, task)
    }
    task.add(receipt)
    return receipt
  }

  private settleReceipt(
    receipt: CreationReceipt,
    outcome: TrackerOutcome,
  ): void {
    if (!receipt.settled) {
      receipt.settled = true
      receipt.settle(outcome)
    }
  }

  private async persistCreates(states: TrackedTaskState[]): Promise<void> {
    try {
      await this.connector.createBatch(states)
    } catch (error) {
      const failure = this.failure(error)
      for (const state of states) {
        const receipt = this.receipts.get(state)
        if (receipt) {
          this.settleReceipt(receipt, failure)
        }
      }
      // The buffer owns its existing requeue policy. Failed receipts remain
      // visible until this exact state is successfully persisted by a retry.
      throw error
    }
    for (const state of states) {
      const receipt = this.receipts.get(state)
      if (!receipt) {
        continue
      }
      this.settleReceipt(receipt, { ok: true })
      const tenant = this.pendingCreates.get(state.tenantId)
      const task = tenant?.get(state.id)
      task?.delete(receipt)
      if (task?.size === 0) {
        tenant?.delete(state.id)
      }
      if (tenant?.size === 0) {
        this.pendingCreates.delete(state.tenantId)
      }
      this.receipts.delete(state)
    }
  }

  private async join(
    outcomes: Iterable<Promise<TrackerOutcome>>,
  ): Promise<void> {
    const results = await Promise.all(outcomes)
    let first: Extract<TrackerOutcome, { ok: false }> | undefined
    for (const result of results) {
      if (result.ok === false && (!first || result.order < first.order)) {
        first = result
      }
    }
    if (first) {
      throw first.error
    }
  }

  private mutate(
    taskId: string,
    tenantId: string,
    updates: () => Partial<TrackedTaskState>,
  ): Promise<void> {
    if (this._isShutdown) {
      return Promise.resolve()
    }
    const receipts = [...(this.pendingCreates.get(tenantId)?.get(taskId) ?? [])]
    return this.own(async () => {
      await this.join(receipts.map(receipt => receipt.outcome))
      await this.connector.update(taskId, tenantId, updates())
      await this.publishUpdate(taskId, tenantId)
    })
  }

  /**
   * Create and track a new task.
   * The task is buffered for high-throughput batch writes.
   *
   * @returns The task ID
   */
  async create(options: CreateTrackedTaskOptions): Promise<string>
  async create(
    taskId: string,
    tenantId: string,
    name: string,
    message?: string,
  ): Promise<string>
  async create(
    taskIdOrOptions: string | CreateTrackedTaskOptions,
    tenantId?: string,
    name?: string,
    message?: string,
  ): Promise<string> {
    if (this._isShutdown) {
      throw new Error('TaskTracker is shutdown')
    }

    return this.own(async () => {
      let taskId: string
      let tenant: string
      let taskName: string
      let taskMessage: string | undefined
      let taskOwnerId: string | undefined

      if (typeof taskIdOrOptions === 'object') {
        taskId = taskIdOrOptions.id ?? Ids.nanoId()
        tenant = taskIdOrOptions.tenantId
        taskName = taskIdOrOptions.name
        taskMessage = taskIdOrOptions.message
        taskOwnerId = taskIdOrOptions.ownerId
      } else {
        taskId = taskIdOrOptions
        tenant = tenantId!
        taskName = name!
        taskMessage = message
      }

      const now = Date.now()
      const state: TrackedTaskState = {
        id: taskId,
        tenantId: tenant,
        name: taskName,
        status: 'QUEUED',
        progress: 0,
        message: taskMessage,
        ownerId: taskOwnerId,
        createdAt: now,
        updatedAt: now,
      }

      // Add to buffer (batched write)
      const receipt = this.receiptFor(state)
      try {
        await this.buffer.add(state)
      } catch (error) {
        // Do not drop ownership if add failed after accepting/requeueing state.
        this.settleReceipt(receipt, this.failure(error))
        throw error
      }

      // Publish immediately for real-time updates
      await this.connector.publish(tenant, taskId, state)

      return taskId
    })
  }

  /**
   * Mark a task as running.
   */
  async start(
    taskId: string,
    tenantId: string,
    message?: string,
  ): Promise<void> {
    return this.mutate(taskId, tenantId, () => {
      return {
        status: 'RUNNING',
        progress: 0,
        message,
        updatedAt: Date.now(),
      }
    })
  }

  /**
   * Update task progress.
   *
   * @param taskId - Task ID
   * @param tenantId - Tenant ID
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  async progress(
    taskId: string,
    tenantId: string,
    progress: number,
    message?: string,
  ): Promise<void>
  async progress(
    taskId: string,
    tenantId: string,
    options: ProgressOptions,
  ): Promise<void>
  async progress(
    taskId: string,
    tenantId: string,
    progressOrOptions: number | ProgressOptions,
    message?: string,
  ): Promise<void> {
    return this.mutate(taskId, tenantId, () => {
      const progressValue =
        typeof progressOrOptions === 'number'
          ? progressOrOptions
          : progressOrOptions.progress
      const messageValue =
        typeof progressOrOptions === 'number'
          ? message
          : progressOrOptions.message

      return {
        progress: Math.min(100, Math.max(0, progressValue)),
        message: messageValue,
        updatedAt: Date.now(),
      }
    })
  }

  /**
   * Mark a task as completed.
   *
   * @param taskId - Task ID
   * @param tenantId - Tenant ID
   * @param result - Optional result data
   */
  async complete(
    taskId: string,
    tenantId: string,
    result?: unknown,
  ): Promise<void> {
    return this.mutate(taskId, tenantId, () => {
      const now = Date.now()
      return {
        status: 'COMPLETED',
        progress: 100,
        result,
        completedAt: now,
        updatedAt: now,
      }
    })
  }

  /**
   * Mark a task as failed.
   *
   * @param taskId - Task ID
   * @param tenantId - Tenant ID
   * @param error - Error message or Error object
   */
  async fail(
    taskId: string,
    tenantId: string,
    error: string | Error,
  ): Promise<void> {
    return this.mutate(taskId, tenantId, () => {
      const now = Date.now()
      const errorMessage = error instanceof Error ? error.message : error

      return {
        status: 'FAILED',
        error: errorMessage,
        completedAt: now,
        updatedAt: now,
      }
    })
  }

  /**
   * Mark a task as cancelled.
   */
  async cancel(
    taskId: string,
    tenantId: string,
    reason?: string,
  ): Promise<void> {
    return this.mutate(taskId, tenantId, () => {
      const now = Date.now()
      return {
        status: 'CANCELLED',
        message: reason,
        completedAt: now,
        updatedAt: now,
      }
    })
  }

  /**
   * Get the current state of a task.
   */
  async get(
    taskId: string,
    tenantId: string,
  ): Promise<TrackedTaskState | null> {
    return this.connector.get(taskId, tenantId)
  }

  /**
   * List all tasks for a specific owner.
   *
   * @param tenantId - Tenant ID
   * @param ownerId - Owner ID (e.g., account ID)
   * @param options - Optional filtering options
   * @returns Array of tasks for the owner
   */
  async listByOwner(
    tenantId: string,
    ownerId: string,
    options?: ListByOwnerOptions,
  ): Promise<TrackedTaskState[]> {
    if (!this.connector.listByOwner) {
      throw new Error(
        'listByOwner is not supported by this connector. Use a connector that supports owner-based queries.',
      )
    }
    return this.connector.listByOwner(tenantId, ownerId, options)
  }

  /**
   * Subscribe to task state updates (for SSE).
   *
   * @returns Unsubscribe function
   */
  subscribe(
    taskId: string,
    tenantId: string,
    callback: TaskStateCallback,
  ): Unsubscribe {
    return this.connector.subscribe(tenantId, taskId, callback)
  }

  /**
   * Helper to publish the current state after an update.
   */
  private async publishUpdate(taskId: string, tenantId: string): Promise<void> {
    const state = await this.connector.get(taskId, tenantId)
    if (state) {
      await this.connector.publish(tenantId, taskId, state)
    }
  }

  /**
   * Get buffer statistics.
   */
  get stats(): { bufferSize: number; pendingFlushes: number } {
    return {
      bufferSize: this.buffer.size,
      pendingFlushes: this.buffer.pendingFlushes,
    }
  }

  /**
   * Check if tracker is shutdown.
   */
  get isShutdown(): boolean {
    return this._isShutdown
  }

  /**
   * Gracefully shutdown the tracker.
   * Drains the buffer to ensure no data loss.
   */
  shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise
    }
    this._isShutdown = true
    const accepted = [...this.operations]
    // Install the shared result before invoking drain/connector callbacks.
    this.shutdownPromise = Promise.resolve().then(async () => {
      const drain = Promise.resolve()
        .then(() => this.buffer.drain())
        .then(
          () => ({ ok: true }) as const,
          error => {
            const failure = this.failure(error)
            // A terminal drain failure may precede batch processing. Release
            // every accepted waiter with failure, never invented persistence.
            for (const tenant of this.pendingCreates.values()) {
              for (const task of tenant.values()) {
                for (const receipt of task) {
                  this.settleReceipt(receipt, failure)
                }
              }
            }
            return failure
          },
        )
      await drain
      await this.join([...accepted, drain])
      if (this.connector.close) {
        await this.connector.close()
      }
    })
    return this.shutdownPromise
  }
}

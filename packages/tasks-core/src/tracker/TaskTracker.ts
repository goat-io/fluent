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
    this.buffer = new IngestBuffer(tasks => this.connector.createBatch(tasks), {
      flushIntervalMs: this.config.flushIntervalMs,
      flushThreshold: this.config.flushThreshold,
      maxConcurrent: this.config.maxConcurrentFlushes,
      strategy: this.config.bufferStrategy,
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
    await this.buffer.add(state)

    // Publish immediately for real-time updates
    await this.connector.publish(tenant, taskId, state)

    return taskId
  }

  /**
   * Mark a task as running.
   */
  async start(
    taskId: string,
    tenantId: string,
    message?: string,
  ): Promise<void> {
    if (this._isShutdown) {
      return
    }

    const updates: Partial<TrackedTaskState> = {
      status: 'RUNNING',
      progress: 0,
      message,
      updatedAt: Date.now(),
    }

    await this.connector.update(taskId, tenantId, updates)
    await this.publishUpdate(taskId, tenantId)
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
    if (this._isShutdown) {
      return
    }

    const progressValue =
      typeof progressOrOptions === 'number'
        ? progressOrOptions
        : progressOrOptions.progress
    const messageValue =
      typeof progressOrOptions === 'number'
        ? message
        : progressOrOptions.message

    const updates: Partial<TrackedTaskState> = {
      progress: Math.min(100, Math.max(0, progressValue)),
      message: messageValue,
      updatedAt: Date.now(),
    }

    await this.connector.update(taskId, tenantId, updates)
    await this.publishUpdate(taskId, tenantId)
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
    if (this._isShutdown) {
      return
    }

    const now = Date.now()
    const updates: Partial<TrackedTaskState> = {
      status: 'COMPLETED',
      progress: 100,
      result,
      completedAt: now,
      updatedAt: now,
    }

    await this.connector.update(taskId, tenantId, updates)
    await this.publishUpdate(taskId, tenantId)
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
    if (this._isShutdown) {
      return
    }

    const now = Date.now()
    const errorMessage = error instanceof Error ? error.message : error

    const updates: Partial<TrackedTaskState> = {
      status: 'FAILED',
      error: errorMessage,
      completedAt: now,
      updatedAt: now,
    }

    await this.connector.update(taskId, tenantId, updates)
    await this.publishUpdate(taskId, tenantId)
  }

  /**
   * Mark a task as cancelled.
   */
  async cancel(
    taskId: string,
    tenantId: string,
    reason?: string,
  ): Promise<void> {
    if (this._isShutdown) {
      return
    }

    const now = Date.now()
    const updates: Partial<TrackedTaskState> = {
      status: 'CANCELLED',
      message: reason,
      completedAt: now,
      updatedAt: now,
    }

    await this.connector.update(taskId, tenantId, updates)
    await this.publishUpdate(taskId, tenantId)
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
  async shutdown(): Promise<void> {
    if (this._isShutdown) {
      return
    }
    this._isShutdown = true

    // Drain the buffer
    await this.buffer.drain()

    // Close connector if supported
    if (this.connector.close) {
      await this.connector.close()
    }
  }
}

/**
 * TaskTracker Types
 *
 * Queue-agnostic task status tracking with support for:
 * - High-throughput buffered writes
 * - Real-time SSE updates via Pub/Sub
 * - Multi-tenant isolation
 */

export type TrackedTaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

/**
 * The state of a tracked task.
 */
export interface TrackedTaskState {
  /** Unique task ID */
  id: string
  /** Tenant ID for multi-tenant isolation */
  tenantId: string
  /** Task name (e.g., "processPost", "sendEmail") */
  name: string
  /** Current status */
  status: TrackedTaskStatus
  /** Progress percentage (0-100) */
  progress: number
  /** Human-readable message describing current step */
  message?: string
  /** Final result (set on completion) */
  result?: unknown
  /** Error message (set on failure) */
  error?: string
  /** Owner ID for querying tasks by user/account (optional) */
  ownerId?: string
  /** Unix timestamp when task was created */
  createdAt: number
  /** Unix timestamp of last update */
  updatedAt: number
  /** Unix timestamp when task completed/failed */
  completedAt?: number
}

/**
 * Configuration for the TaskTracker.
 */
export interface TaskTrackerConfig {
  /**
   * Interval in milliseconds to flush the buffer.
   * @default 10
   */
  flushIntervalMs: number

  /**
   * Number of items to trigger an immediate flush.
   * @default 100
   */
  flushThreshold: number

  /**
   * Maximum concurrent flush operations.
   * @default 50
   */
  maxConcurrentFlushes: number

  /**
   * Buffer sizing strategy.
   * - STATIC: Always flush at flushThreshold
   * - DYNAMIC: Uses Fibonacci sizing based on concurrent flushes (backpressure)
   * @default 'DYNAMIC'
   */
  bufferStrategy: 'STATIC' | 'DYNAMIC'

  /**
   * TTL in seconds for completed tasks.
   * @default 86400 (24 hours)
   */
  completedTaskTTL: number

  /**
   * TTL in seconds for failed tasks.
   * @default 604800 (7 days)
   */
  failedTaskTTL: number
}

/**
 * Default configuration for TaskTracker.
 */
export const DEFAULT_TRACKER_CONFIG: TaskTrackerConfig = {
  flushIntervalMs: 10,
  flushThreshold: 100,
  maxConcurrentFlushes: 50,
  bufferStrategy: 'DYNAMIC',
  completedTaskTTL: 86400,
  failedTaskTTL: 604800,
}

/**
 * Callback for task state updates (used in subscriptions).
 */
export type TaskStateCallback = (state: TrackedTaskState) => void

/**
 * Unsubscribe function returned by subscribe().
 */
export type Unsubscribe = () => void

/**
 * Interface for TaskTracker storage connectors.
 *
 * Implementations:
 * - RedisTaskTrackerConnector: Production use with Pub/Sub for SSE
 * - InMemoryTaskTrackerConnector: Testing and single-instance use
 * - MySQLTaskTrackerConnector: Persistence/audit trail (optional)
 */
export interface TaskTrackerConnector {
  /**
   * Batch create multiple tasks.
   * Used by the buffer for high-throughput writes.
   */
  createBatch(tasks: TrackedTaskState[]): Promise<void>

  /**
   * Update a task's state.
   */
  update(
    taskId: string,
    tenantId: string,
    updates: Partial<TrackedTaskState>,
  ): Promise<void>

  /**
   * Get a task's current state.
   */
  get(taskId: string, tenantId: string): Promise<TrackedTaskState | null>

  /**
   * Publish a task state update (for real-time notifications).
   */
  publish(
    tenantId: string,
    taskId: string,
    state: TrackedTaskState,
  ): Promise<void>

  /**
   * Subscribe to task state updates.
   * @returns Unsubscribe function
   */
  subscribe(
    tenantId: string,
    taskId: string,
    callback: TaskStateCallback,
  ): Unsubscribe

  /**
   * List all tasks for a specific owner.
   * Returns tasks in any status (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED).
   * Optional - only connectors that support owner-based queries need to implement this.
   */
  listByOwner?(
    tenantId: string,
    ownerId: string,
    options?: ListByOwnerOptions,
  ): Promise<TrackedTaskState[]>

  /**
   * Clean up old tasks (optional, for connectors with TTL support).
   */
  cleanup?(tenantId: string, olderThanMs: number): Promise<number>

  /**
   * Close connections and clean up resources.
   */
  close?(): Promise<void>
}

/**
 * Options for creating a tracked task.
 */
export interface CreateTrackedTaskOptions {
  /** Task ID (auto-generated if not provided) */
  id?: string
  /** Tenant ID for isolation */
  tenantId: string
  /** Task name */
  name: string
  /** Initial message */
  message?: string
  /** Owner ID for querying tasks by user/account (optional) */
  ownerId?: string
  /** Additional metadata to store */
  metadata?: Record<string, unknown>
}

/**
 * Options for updating task progress.
 */
export interface ProgressOptions {
  /** Progress percentage (0-100) */
  progress: number
  /** Human-readable message */
  message?: string
}

/**
 * Options for listing tasks by owner.
 */
export interface ListByOwnerOptions {
  /** Filter by status (default: all statuses) */
  status?: TrackedTaskStatus | TrackedTaskStatus[]
  /** Maximum number of tasks to return (default: 100) */
  limit?: number
}

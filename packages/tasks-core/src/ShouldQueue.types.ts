export type TaskStatusName =
  | 'QUEUED'
  | 'RUNNING'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JsonValue }
  | JsonValue[]

export type JsonObject = { [x: string]: JsonValue }

/**
 * Constraint for task payloads. Uses `object` so that concrete
 * interfaces like `{ tenantId: string }` satisfy the generic
 * without needing an explicit index signature (TypeScript interfaces
 * don't have implicit index signatures, so Record<string, unknown>
 * doesn't work).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type InputType = object

export type OutputType = undefined | JsonObject
export type UnknownInputType = {}

export interface TaskStatus<T extends InputType = UnknownInputType> {
  id: string
  name: string
  status: TaskStatusName
  output: string
  attempts: number
  created: string
  nextRun: string | null
  nextRunMinutes: number | null
  payload: T
}

/**
 * Credentials for tenant-specific connections.
 * Used when stronger isolation is needed (e.g., Redis ACL users).
 */
export interface TenantCredentials {
  username?: string
  password?: string
}

/**
 * Configuration for tenant isolation.
 */
export interface TenantConfig {
  /**
   * The tenant identifier used for isolation.
   * This will be used as a prefix for keys/queues to ensure tenant data separation.
   */
  tenantId: string

  /**
   * Optional credentials for tenant-specific connections.
   * When provided, enables stronger isolation through separate authentication.
   * For Redis (BullMQ): Creates connection with tenant-specific ACL user.
   * For Hatchet: Uses tenant-specific API credentials.
   * For GCP: Uses tenant-specific service account.
   */
  credentials?: TenantCredentials
}

/**
 * A task class constructor.
 * Accepts optional ShouldQueueOptions (connector injected after construction).
 */
export type TaskClass = new (
  opts?: any,
) => import('./ShouldQueue').ShouldQueue<any, any, any>

export interface TaskConnector<TInput> {
  /**
   * The tenant ID this connector is scoped to.
   * When set, all operations are isolated to this tenant's namespace.
   */
  readonly tenantId?: string

  /**
   * Queue a task for execution.
   */
  queue(params: {
    uniqueTaskName: string
    taskName: string
    postUrl: string
    taskBody: TInput
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>>

  /**
   * Bulk-enqueue many tasks in one round-trip when the backend supports it.
   *
   * - **BullMQ**: implemented as `Queue.addBulk` per target queue (one Lua
   *   script roundtrip per queue, vs. N RTTs for a queue() loop). Sweet spot
   *   is ≤1000 jobs per call — see BullMQ issue #1670.
   * - **GCP Cloud Tasks / Hatchet / others**: not yet implemented. Callers
   *   that need backend-agnostic bulk enqueue should fall back to looping
   *   `queue()` when this method is absent.
   *
   * Returns one TaskStatus per input job, in the same order. On partial
   * failure the implementation throws — bulk semantics are all-or-nothing.
   */
  bulkQueue?(jobs: Array<{
    uniqueTaskName: string
    taskName: string
    taskBody: TInput
    /** Per-job options (e.g. priority, deduplication id). Adapter-specific. */
    opts?: Record<string, unknown>
  }>): Promise<Array<Omit<TaskStatus, 'payload'>>>

  /**
   * Get the status of a task by its ID.
   */
  getStatus(id: string): Promise<TaskStatus>

  /**
   * Create a new connector instance scoped to a specific tenant.
   * This enables multi-tenant isolation where different tenants
   * share the same underlying infrastructure but have isolated data.
   *
   * Implementation varies by adapter:
   * - BullMQ: Uses tenant ID as Redis key prefix (e.g., "tenantId:bull:queue:*")
   * - Hatchet: Uses tenant ID in Hatchet's built-in tenant system
   * - GCP Cloud Tasks: Uses tenant ID as queue name prefix
   *
   * @param tenantId - The tenant identifier for isolation
   * @param credentials - Optional credentials for stronger isolation (e.g., Redis ACL user)
   * @returns A new connector instance scoped to the tenant
   */
  forTenant?(
    tenantId: string,
    credentials?: TenantCredentials,
  ): TaskConnector<TInput>

  /**
   * Optional hook called after a job is enqueued to the tenant queue.
   * Used by the dispatch system to write a hint to the global dispatch queue.
   * Active when dispatch is configured.
   *
   * @param params - Job metadata for dispatch hint creation
   */
  onAfterQueue?(params: {
    tenantId: string
    queueName: string
    jobId: string
    priority?: number
  }): Promise<void>

  /**
   * Process incoming dispatch work for this tenant's queues.
   * Called by the HTTP dispatch endpoint after tenant container is bootstrapped.
   *
   * Each adapter handles this differently:
   * - BullMQ: Creates temp Workers, fetches jobs from tenant queues, executes handler
   * - GCP: Executes task from hint.data (already included in HTTP push)
   * - Hatchet: Similar to BullMQ
   */
  processIncomingDispatch?(params: {
    /** Callback to execute a task by queue name and payload */
    handleTask: (queueName: string, data: unknown) => Promise<unknown>
    /** Time budget in ms (default 25_000). Processing stops when exceeded. */
    timeBudgetMs?: number
    /** Valid queue names to process. If provided, unknown queues are skipped. */
    validQueueNames?: Set<string>
    /**
     * Number of jobs to pull from the queue per inner iteration. Each inner
     * iteration pulls `batchSize` jobs in parallel, then runs handlers in
     * parallel (capped by `concurrency`), then acks all in parallel. Default 50.
     *
     * Tune based on queue characteristics:
     *  - High-throughput batched queues (engine ingest): 200
     *  - Notification-style fire-and-forget: 50 (default)
     *  - Slow / serialized work: 1 (legacy behaviour)
     */
    batchSize?: number
    /**
     * Maximum in-flight handler invocations. Caps parallelism when batchSize is
     * larger than what your handler can absorb. Default: same as batchSize.
     */
    concurrency?: number
    /** Hint from the dispatch notification (optional — may contain data for push-based adapters) */
    hint?: {
      tenantId?: string
      queueName?: string
      jobId?: string
      data?: unknown
    }
  }): Promise<{ processed: number; failed: number }>

  /**
   * Start persistent workers that consume jobs from queues.
   *
   * Each adapter handles this differently:
   * - BullMQ: Creates persistent Workers per task queue
   * - GCP: Could set up Cloud Tasks push receivers
   * - Hatchet: Registers workflow listeners
   *
   * @returns Handle to stop the workers and check running status
   */
  listen?(params: {
    tasks: Array<{
      taskName: string
      handle: (data: unknown) => Promise<unknown>
      concurrency?: number
    }>
    defaultConcurrency?: number
  }): Promise<{ stop: () => Promise<void>; isRunning: () => boolean }>
}

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

export type InputType = {
  [x: string]: JsonValue
} & {
  [x: string]: JsonValue
}

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
   * Only active in 'shared' dispatch mode.
   *
   * @param params - Job metadata for dispatch hint creation
   */
  onAfterQueue?(params: {
    tenantId: string
    queueName: string
    jobId: string
    priority?: number
  }): Promise<void>
}

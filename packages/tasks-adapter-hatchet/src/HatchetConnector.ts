import { Ids, Memo } from '@goatlab/js-utils'
import type {
  ShouldQueue,
  TaskConnector,
  TaskStatus,
  TenantCredentials
} from '@goatlab/tasks-core'
import { Hatchet } from '@hatchet-dev/typescript-sdk'

// Default configuration constants
const DEFAULT_HOST_PORT = 'localhost:7077'
const DEFAULT_API_URL = 'http://localhost:8888'
const DEFAULT_LOG_LEVEL = 'INFO'
const DEFAULT_HATCHET_TENANT_ID = '707d0855-80ab-4e1f-a156-f1c4546cbf52'

/**
 * HatchetConnector - TaskConnector implementation for Hatchet.
 *
 * ## Implementation Notes
 *
 * ### Why we use `admin.runWorkflow()` instead of `task.runNoWait()`
 *
 * Both methods are fire-and-forget (they only wait for the run ID, not task completion).
 * However, `task.runNoWait()` internally uses a global `parentRunContextManager` to track
 * parent/child workflow relationships:
 *
 * ```js
 * // Inside task.runNoWait() - declaration.js:46-47
 * const parentRunContext = parentRunContextManager.getContext();
 * parentRunContextManager.incrementChildIndex(...);
 * ```
 *
 * This global state causes issues when queuing many tasks rapidly in parallel - concurrent
 * calls interfere with each other through this shared state, potentially causing duplicate
 * run IDs or other race conditions.
 *
 * By calling `admin.runWorkflow()` directly, we bypass:
 * - The `parentRunContextManager` global state
 * - The `childIndex` tracking
 * - The `childKey` / `sticky` handling
 *
 * These features are designed for spawning child workflows from within a parent task,
 * not for high-volume top-level task queuing.
 *
 * ### Eventual Consistency between gRPC and REST API
 *
 * Hatchet uses gRPC for `queue()` (triggerWorkflow) and REST API for `getStatus()` (runs.get).
 * There can be a brief delay before a newly created run is visible via REST API.
 * We handle this with retry logic in `getStatus()`.
 *
 * @see https://docs.hatchet.run/home/run-no-wait
 * @see https://docs.hatchet.run/home/v1-sdk-improvements
 */
/**
 * Configuration for HatchetConnector
 */
export interface HatchetConnectorConfig {
  /**
   * Hatchet API token for authentication.
   */
  token: string

  /**
   * Hatchet gRPC host and port.
   * Default: 'localhost:7077'
   */
  hostAndPort?: string

  /**
   * Hatchet REST API URL.
   * Default: 'http://localhost:8888'
   */
  apiUrl?: string

  /**
   * Log level for Hatchet client.
   * Default: 'INFO'
   */
  logLevel?: 'INFO' | 'OFF' | 'DEBUG' | 'WARN' | 'ERROR'

  /**
   * Hatchet's internal tenant ID (requires separate token per tenant).
   * This is different from our multi-tenant isolation - use `tenantId` instead.
   */
  hatchetTenantId?: string

  /**
   * Tenant ID for multi-tenant isolation using Hatchet namespaces.
   * When set, this is used as the Hatchet namespace to isolate:
   * - Workflows only trigger for this namespace
   * - Events remain isolated to this namespace
   * - Workers only process jobs from this namespace
   *
   * This allows multiple tenants to share the same Hatchet instance
   * and token while maintaining isolation.
   */
  tenantId?: string
}

export class HatchetConnector implements TaskConnector<object> {
  private readonly token: string
  private readonly hostAndPort: string
  private readonly apiUrl: string
  private readonly logLevel: 'INFO' | 'OFF' | 'DEBUG' | 'WARN' | 'ERROR'
  private readonly hatchetTenantId: string
  private readonly _tenantId?: string
  private readonly config: HatchetConnectorConfig

  // Store registered workflows by taskName for reuse in queue()
  private registeredWorkflows: Map<string, any> = new Map()

  /**
   * The tenant ID this connector is scoped to.
   * Uses Hatchet namespaces for isolation within the same Hatchet instance.
   */
  public get tenantId(): string | undefined {
    return this._tenantId
  }

  /**
   * The Hatchet namespace used for isolation.
   * This is the same as tenantId when set.
   */
  public get namespace(): string {
    return this._tenantId || ''
  }

  constructor(config: HatchetConnectorConfig) {
    this.config = config
    this.token = config.token || ''
    this.hostAndPort = config.hostAndPort || DEFAULT_HOST_PORT
    this.apiUrl = config.apiUrl || DEFAULT_API_URL
    this.logLevel = config.logLevel || DEFAULT_LOG_LEVEL
    this.hatchetTenantId = config.hatchetTenantId || ''
    this._tenantId = config.tenantId
  }

  /**
   * Creates a new HatchetConnector instance scoped to a specific tenant.
   * Uses Hatchet namespaces for isolation within the same Hatchet instance.
   *
   * @param tenantId - The tenant identifier for isolation (used as Hatchet namespace)
   * @param _credentials - Not used for Hatchet (namespaces share the same token)
   * @returns A new HatchetConnector instance scoped to the tenant
   *
   * @example
   * ```typescript
   * const baseConnector = new HatchetConnector({ token: 'my-token' })
   *
   * // Create tenant-scoped connector
   * const tenantConnector = baseConnector.forTenant('acme-corp')
   * // Namespace: acme-corp (workflows isolated to this namespace)
   * ```
   */
  forTenant(
    tenantId: string,
    _credentials?: TenantCredentials
  ): HatchetConnector {
    return new HatchetConnector({
      ...this.config,
      tenantId
    })
  }

  /**
   * Gets or creates a memoized Hatchet client.
   *
   * IMPORTANT: Due to memoization, each unique combination of config creates
   * a separate client. This means tenant-scoped connectors get their own client
   * with the correct namespace.
   */
  @Memo.syncMethod()
  public getHatchetClient() {
    const hatchet = Hatchet.init({
      token: this.token,
      host_port: this.hostAndPort,
      api_url: this.apiUrl,
      log_level: this.logLevel,
      // Hatchet's internal tenant ID (requires separate token)
      tenant_id: this.hatchetTenantId || DEFAULT_HATCHET_TENANT_ID,
      // Use tenantId as namespace for multi-tenant isolation
      // This prefixes workflows and isolates events/workers
      namespace: this._tenantId || '',
      tls_config: {
        tls_strategy: 'none'
      }
    })

    return hatchet
  }

  getHatchetTask(task: ShouldQueue) {
    const hatchetTask = this.getHatchetClient().task({
      name: task.taskName,
      retries: task.retries || 3,
      fn: task.handle.bind(task)
    })

    this.registeredWorkflows.set(task.taskName, hatchetTask)
    return hatchetTask
  }

  async startWorker({
    workerName,
    tasks,
    slots = 100
  }: {
    workerName?: string
    tasks: any[]
    slots?: number
  }) {
    // Pre-map workflows to avoid repeated processing
    const workflows = tasks.map(task => this.getHatchetTask(task))

    const worker = await this.getHatchetClient().worker(
      `${workerName}-${Ids.nanoId(5)}`,
      {
        // 👀 Declare the workflows that the worker can execute
        workflows,
        // 👀 Declare the number of concurrent task runs the worker can accept
        slots
      }
    )

    void worker.start()
    // Give the worker some time to start
    await new Promise(resolve => setTimeout(resolve, 1000))
    return worker
  }

  /**
   * Gets the status of a task by its Hatchet run ID.
   *
   * Uses `runs.get()` which calls the REST API endpoint `/api/v1/stable/workflow-runs/{id}`.
   * Includes retry logic (3 attempts with exponential backoff) to handle eventual
   * consistency between gRPC (used by queue) and REST API (used here).
   *
   * The payload is double-nested in Hatchet's response: `run.input.input` contains
   * the actual payload we passed to `queue()`.
   *
   * @param id - The Hatchet workflow run ID returned by `queue()`.
   * @returns Full task status including payload, status, and metadata.
   * @throws Error if the run cannot be found after all retry attempts.
   */
  async getStatus(id: string): Promise<TaskStatus> {
    const hatchet = this.getHatchetClient()
    const maxRetries = 3
    const retryDelay = 200 // ms, with exponential backoff

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const details = await hatchet.runs.get(id)
        const run = details.run

        const taskName = run?.displayName?.split('-')[0] || ''
        // Payload is double-nested: run.input.input contains actual payload
        const inputWrapper = run?.input as any
        const payload = inputWrapper?.input || {}

        return {
          id,
          attempts: 0,
          payload,
          status: run?.status as any,
          created: run?.metadata?.createdAt || new Date().toISOString(),
          name: taskName,
          nextRun: null,
          nextRunMinutes: null,
          output: run?.output as any
        }
      } catch (error: any) {
        // Retry on 404 - eventual consistency between gRPC and REST API
        if (error?.response?.status === 404 && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }
    }

    throw new Error(
      `Failed to get status for ${id} after ${maxRetries} attempts`
    )
  }

  /**
   * Queues a task to be run in the background (fire-and-forget).
   *
   * Uses `admin.runWorkflow()` directly instead of `task.runNoWait()` to avoid
   * the global `parentRunContextManager` state that causes race conditions
   * when queuing tasks rapidly. See class documentation for details.
   *
   * @param params.taskName - Name of the task (must match a registered workflow).
   * @param params.taskBody - The payload to pass to the task handler.
   * @returns Task status with unique run ID. Does NOT wait for task completion.
   */
  async queue(params: any): Promise<Omit<TaskStatus, 'payload'>> {
    const hatchet = this.getHatchetClient()
    const ref = await hatchet.admin.runWorkflow(
      params.taskName,
      params.taskBody,
      {}
    )
    const runId = await ref.getWorkflowRunId()

    return {
      id: runId,
      name: ref._standaloneTaskName || params.taskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: new Date().toISOString(),
      nextRun: null,
      nextRunMinutes: null
    }
  }
}

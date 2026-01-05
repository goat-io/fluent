import { assert, Ids, Memo, Primitive, Promises } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import type {
  TaskConnector,
  TaskStatus,
  TaskStatusName,
  TenantCredentials,
} from '@goatlab/tasks-core'
import type { BackoffSettings } from 'google-gax/build/src/gax'
import { GCPServiceAccount } from './CloudTaskConnector.types.js'
export type ITask = any

export type { BackoffSettings }

/**
 * Configuration for CloudTaskConnector
 */
export interface CloudTaskConnectorConfig {
  /**
   * GCP service account credentials for authentication.
   */
  gcpServiceAccount?: GCPServiceAccount

  /**
   * GCP region/location for Cloud Tasks queues.
   * Default: 'europe-west1'
   */
  location?: string

  /**
   * Encryption key for task body encryption.
   */
  encryptionKey?: string

  /**
   * GCP project ID.
   */
  gcpProject: string

  /**
   * Tenant ID for multi-tenant isolation.
   * When set, this tenant ID is used as a prefix for task names.
   *
   * Task naming pattern: {tenantId}-{taskName}
   * Example: "acme-corp-my-task" instead of "my-task"
   *
   * This ensures each tenant's tasks are uniquely identified,
   * providing isolation at the task level while sharing the same queue.
   */
  tenantId?: string

  /**
   * Enable in-memory payload caching for testing.
   * GCP Cloud Tasks removes completed tasks immediately, which means
   * getStatus() cannot retrieve the payload after completion.
   *
   * When enabled, payloads are cached in memory when queueing
   * and returned from getStatus() even after the task is removed.
   *
   * WARNING: Only enable for testing. In production, this will cause
   * memory leaks as payloads accumulate.
   *
   * Default: false
   */
  enablePayloadCache?: boolean
}

const defaultBackoffSettings: BackoffSettings = {
  maxRetries: 2,
  initialRetryDelayMillis: 2000,
  retryDelayMultiplier: 1.5,
  maxRetryDelayMillis: 3600,
  initialRpcTimeoutMillis: 6000,
}

// Pre-calculated constants
const MS_TO_MINUTES = 1 / 60000

function getScheduledInfo(scheduled: number): {
  minutesUntil: number
} {
  if (scheduled === 0) {
    return {
      minutesUntil: 0,
    }
  }

  // Avoid multiple multiplication - calculate difference directly
  const minutesUntil = Math.floor(
    (scheduled * 1000 - Date.now()) * MS_TO_MINUTES,
  )

  return { minutesUntil }
}

export class CloudTaskConnector implements TaskConnector<object> {
  private gcpServiceAccount: GCPServiceAccount
  private location: string
  private encryptionKey: string
  private gcpProject: string
  private readonly _tenantId?: string
  private readonly config: CloudTaskConnectorConfig
  private readonly enablePayloadCache: boolean

  /**
   * Cache for task payloads (only used when enablePayloadCache is true).
   * GCP Cloud Tasks removes completed tasks immediately, so we cache the payload
   * to return it when getStatus is called after completion.
   * Key: task name (full path), Value: { payload, createdAt }
   */
  private static payloadCache: Map<
    string,
    { payload: Record<string, any>; createdAt: number }
  > = new Map()

  /**
   * How long to keep payloads in cache (1 hour)
   */
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000

  /**
   * The tenant ID this connector is scoped to.
   * When set, task names are prefixed with this tenant ID.
   */
  public get tenantId(): string | undefined {
    return this._tenantId
  }

  constructor(config: CloudTaskConnectorConfig) {
    this.config = config
    this.gcpServiceAccount = (config.gcpServiceAccount ||
      '') as GCPServiceAccount
    this.location = config.location || 'europe-west1'
    this.encryptionKey = config.encryptionKey || ''
    this.gcpProject = config.gcpProject || ''
    this._tenantId = config.tenantId
    this.enablePayloadCache = config.enablePayloadCache ?? false

    // Periodically clean up old cache entries (only if caching is enabled)
    if (this.enablePayloadCache) {
      this.cleanupCache()
    }
  }

  /**
   * Cleans up expired entries from the payload cache.
   */
  private cleanupCache(): void {
    if (!this.enablePayloadCache) {
      return
    }
    const now = Date.now()
    for (const [key, value] of CloudTaskConnector.payloadCache) {
      if (now - value.createdAt > CloudTaskConnector.CACHE_TTL_MS) {
        CloudTaskConnector.payloadCache.delete(key)
      }
    }
  }

  /**
   * Caches a task's payload for later retrieval.
   * Only caches if enablePayloadCache is true.
   */
  private cachePayload(taskName: string, payload: Record<string, any>): void {
    if (!this.enablePayloadCache) {
      return
    }
    CloudTaskConnector.payloadCache.set(taskName, {
      payload,
      createdAt: Date.now(),
    })
  }

  /**
   * Gets a cached payload if available.
   * Only returns cached data if enablePayloadCache is true.
   */
  private getCachedPayload(taskName: string): Record<string, any> | undefined {
    if (!this.enablePayloadCache) {
      return undefined
    }
    const cached = CloudTaskConnector.payloadCache.get(taskName)
    if (cached) {
      // Check if expired
      if (Date.now() - cached.createdAt > CloudTaskConnector.CACHE_TTL_MS) {
        CloudTaskConnector.payloadCache.delete(taskName)
        return undefined
      }
      return cached.payload
    }
    return undefined
  }

  /**
   * Creates a new CloudTaskConnector instance scoped to a specific tenant.
   * Uses tenant ID as a prefix for queue names for isolation.
   *
   * @param tenantId - The tenant identifier for isolation (used as queue name prefix)
   * @param credentials - Optional GCP credentials for the tenant (uses parent's if not provided)
   * @returns A new CloudTaskConnector instance scoped to the tenant
   *
   * @example
   * ```typescript
   * const baseConnector = new CloudTaskConnector({ gcpProject: 'my-project' })
   *
   * // Create tenant-scoped connector
   * const tenantConnector = baseConnector.forTenant('acme-corp')
   * // Queue names: acme-corp-default, acme-corp-email-queue, etc.
   * ```
   */
  forTenant(
    tenantId: string,
    _credentials?: TenantCredentials,
  ): CloudTaskConnector {
    return new CloudTaskConnector({
      ...this.config,
      tenantId,
    })
  }

  /**
   * Sanitizes a string for use in GCP Cloud Tasks names.
   * GCP names only allow letters, numbers, and hyphens.
   * @param value - The value to sanitize
   * @returns Sanitized value safe for GCP names
   */
  private sanitizeForGcp(value: string): string {
    // Replace underscores and other invalid chars with hyphens
    // Remove any consecutive hyphens and trim hyphens from ends
    return value
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * Gets the task name with tenant prefix applied if tenant is set.
   * Task-level isolation: all tenants share the same queue, but task names are prefixed.
   * This avoids the overhead of creating separate queues per tenant.
   * @param taskName - The base task name
   * @returns The full task name with tenant prefix if applicable
   */
  private getTaskName(taskName: string): string {
    const sanitizedTask = this.sanitizeForGcp(taskName)
    if (this._tenantId) {
      const sanitizedTenant = this.sanitizeForGcp(this._tenantId)
      return `${sanitizedTenant}-${sanitizedTask}`
    }
    return sanitizedTask
  }

  @Memo.asyncMethod()
  private async getCloudTasksClient() {
    const cloudTasks = await import('@google-cloud/tasks')

    console.log(
      `Initializing cloud-tasks pointing at project: ${this.gcpProject}`,
    )

    return new cloudTasks.CloudTasksClient({
      credentials: this.gcpServiceAccount,
      projectId: this.gcpProject,
    })
  }
  /**
   * Adds a task to the Cloud Tasks queue.
   *
   */
  async addTask({
    task,
    queueName = 'default',
    backoffSettings = defaultBackoffSettings,
    baseUrl,
  }: {
    task: ITask
    queueName: string
    backoffSettings: any
    baseUrl?: string
  }) {
    assert(task.httpRequest, `task.httpRequest property is required`)

    const { url } = task.httpRequest
    assert(url, 'Task URL is required')

    // Parse URL to point to the correct backend - simplified without async wrapper
    const parsedURL = new URL(url, baseUrl)
    assert(parsedURL, 'Task URL is invalid')

    const client = await this.getCloudTasksClient()
    // Use queue name directly - tenant isolation is at task name level, not queue level
    const parent = client.queuePath(this.gcpProject, this.location, queueName)

    // Build the task object in one go to avoid multiple spreads
    const finalTask = {
      ...task,
      name:
        task.name && !task.name.startsWith(parent)
          ? `${parent}/tasks/${task.name}`
          : task.name,
      httpRequest: {
        ...task.httpRequest,
        url: parsedURL.href,
        headers: {
          'content-type': 'application/octet-stream',
        },
        // We can encrypt the content to later verify that it was sent by us
        body: this.encryptBody({
          content: String(task.httpRequest?.body),
        }),
      },
    }

    // Skip sending tasks in local environment
    // this will make the task run before
    // the endpoint returns
    // if (env.local) {
    //   if (!task.httpRequest?.url) {
    //     return task
    //   }
    //   // Voiding to avoid waiting for the task
    //   void fetch(task.httpRequest.url, {
    //     method: 'POST',
    //     headers: {
    //       'local-queue': 'true',
    //       ...task.httpRequest?.headers
    //     },
    //     body: task.httpRequest?.body,
    //     signal: AbortSignal.timeout(120_000)
    //   })
    //   return task
    // }

    const [response] = await client.createTask(
      {
        parent,
        task: finalTask,
      },
      {
        retry: {
          retryCodes: [
            2, // UNKNOWN
            14, // INTERNAL
          ],
          backoffSettings,
        },
      },
    )

    return response
  }

  /**
   * Lists all failed tasks in the specified queue.
   * It filters tasks that have been dispatched more than twice,
   * indicating they have failed.
   *
   * @param queueName - Name of the queue to list failed tasks from.
   * @returns An array of failed tasks.
   */
  async listFailedTasks(queueName = 'default') {
    const client = await this.getCloudTasksClient()
    // Use queue name directly - tenant isolation is at task name level
    const parent = client.queuePath(this.gcpProject, this.location, queueName)

    // We have to be careful with the response, as it can be large.
    const [tasks] = await client.listTasks({ parent, responseView: 'FULL' })

    return tasks.filter(task => {
      return task.dispatchCount || 0 > 2
    })
  }

  /**
   * Decrypts the body of a task.
   * This service encrypts the body of the task before sending it,
   * so this method is used to decrypt it back to its original form.
   * It expects the body to be a Buffer or string, and it will parse it as JSON.
   * If the body is not provided, it defaults to an empty Buffer.
   *
   * @param body - The body of the task, which is expected to be a Buffer or string.
   * @returns The decrypted body as a Record<string, Primitive>.
   */
  decryptBody(body?: Buffer | null | string | any) {
    if (!body) {
      return {} as Record<string, Primitive>
    }

    // Direct parsing without intermediate buffer conversion for strings
    const bodyJSON = JSON.parse(
      typeof body === 'string' ? body : Buffer.from(body).toString('ascii'),
    )

    const decryptedBody = Security.decryptObject(
      bodyJSON,
      this.encryptionKey,
    ) as any

    return JSON.parse(decryptedBody.content) as Record<string, Primitive>
  }

  /**
   * Encrypts the body of a task.
   * This service encrypts the body of the task before sending it,
   * so this method is used to encrypt it.
   * It expects the body to be a Record<string, any> and returns a base64 encoded string.
   *
   * @param obj - The object to encrypt.
   * @returns The encrypted body as a base64 encoded string.
   */

  encryptBody(obj: Record<string, any>): string | Uint8Array {
    const encrypted = Security.encryptObject(obj, this.encryptionKey)

    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  /**
   * Gets the status of a task by its name.
   * Implements the TaskConnector interface.
   * @param name - Name of the task.
   */
  async getStatus(name: string): Promise<TaskStatus> {
    const client = await this.getCloudTasksClient()
    const [error, resp] = await Promises.try(
      client.getTask({ name, responseView: 'FULL' }),
    )

    // This in most cases will mean success, given that the tasks get removed once they are done
    if (error?.message.includes('The task no longer exists')) {
      // Extract task name once
      const taskName = name?.split('/').pop() || ''
      // Use cached payload if available (GCP removes completed tasks immediately)
      const cachedPayload = this.getCachedPayload(name) || {}
      return {
        id: name,
        name: taskName,
        output: error?.message,
        attempts: 0,
        status: 'COMPLETED',
        created: new Date().toISOString(),
        nextRun: null,
        nextRunMinutes: null,
        payload: cachedPayload,
      }
    }

    const task = resp[0]

    // Extract values once
    const dispatchCount = task.dispatchCount ?? 0
    const responseCount = task.responseCount || 0
    const creation = Number(task.createTime?.seconds || 0) || 0
    const scheduled = Number(task.scheduleTime?.seconds || 0) || 0

    // Determine status with simplified logic
    let status: TaskStatusName = 'RUNNING'
    if (responseCount === 0 && (dispatchCount > 2 || dispatchCount <= 1)) {
      status = 'FAILED'
    } else if (responseCount > 0) {
      status = 'COMPLETED'
    }

    return {
      id: task.name || '',
      name: task.name?.split('/').pop() || '',
      attempts: dispatchCount,
      output: task.lastAttempt?.responseStatus?.message || '',
      status,
      created: new Date(creation * 1000).toISOString(),
      nextRun: scheduled ? new Date(scheduled * 1000).toISOString() : null,
      nextRunMinutes: scheduled
        ? getScheduledInfo(scheduled).minutesUntil
        : null,
      payload: this.decryptBody(task.httpRequest?.body),
    }
  }

  /**
   * Schedules a task to be run in the future.
   * Implements the TaskConnector interface.
   * @param params
   * @param params.taskName - Name of the task.
   * @param params.postUrl - URL to post the task to.
   * @param params.taskBody - Body of the task.
   */
  async queue(params: any): Promise<Omit<TaskStatus, 'payload'>> {
    // Apply tenant prefix to task name for multi-tenant isolation
    // All tenants share the same queue, but task names are prefixed
    const baseTaskName = `${params.uniqueTaskName}-${Ids.nanoId(5)}`
    const taskName = this.getTaskName(baseTaskName)

    const task = await this.addTask({
      task: {
        name: taskName,
        httpRequest: {
          url: params.postUrl,
          body: JSON.stringify(params.taskBody),
        },
      },
      queueName: params.queueName || 'default',
      backoffSettings: defaultBackoffSettings,
    })

    // Cache the payload so we can return it even after GCP removes the completed task
    if (task.name) {
      this.cachePayload(task.name, params.taskBody)
    }

    const creation = Number(task.createTime?.seconds || 0) || 0
    const scheduled = Number(task.scheduleTime?.seconds || 0) || 0

    return {
      id: task.name,
      name: params.taskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: creation
        ? new Date(creation * 1000).toISOString()
        : new Date().toISOString(),
      nextRun: scheduled ? new Date(scheduled * 1000).toISOString() : null,
      nextRunMinutes: null,
    }
  }
}

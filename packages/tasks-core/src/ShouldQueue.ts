import { Ids } from '@goatlab/js-utils'
import type {
  InputType,
  OutputType,
  TaskConnector,
  TaskStatus,
  TenantCredentials,
  UnknownInputType,
} from './ShouldQueue.types'
import type { TaskTracker } from './tracker/TaskTracker'

/**
 * Internal field name for the tracker task ID.
 * Added to payload when tracker is enabled.
 */
const TRACKER_ID_FIELD = '__trackerId'

/**
 * Extended payload type that includes tracker metadata.
 */
type TrackedPayload<T> = T & {
  [TRACKER_ID_FIELD]?: string
}

export interface ShouldQueueOptions<TInput> {
  connector?: TaskConnector<TInput>
  basePostUrl?: string
  /**
   * Optional TaskTracker for status tracking.
   * When provided, task lifecycle is automatically tracked.
   */
  tracker?: TaskTracker
}

export abstract class ShouldQueue<
  TInput extends InputType = UnknownInputType,
  TResult extends OutputType = undefined,
  TName extends string = string,
> {
  public abstract readonly taskName: TName
  public abstract readonly postUrl: string
  public basePostUrl?: string

  public abstract handle(taskBody: TInput): Promise<TResult>

  public retries = 3

  /**
   * Declared input field names for runtime introspection.
   * Override in subclasses to enable auto-generated trigger forms
   * in workflow UIs. Field names should match TInput keys.
   *
   * @example
   *   inputFields = ['postId'] as const
   */
  public inputFields?: readonly string[]

  /**
   * Fields containing PII or sensitive data that should be redacted
   * in workflow UIs. Values are masked in I/O panels.
   */
  public sensitiveFields?: readonly string[]
  public connector!: TaskConnector<TInput>
  public tracker?: TaskTracker

  /**
   * Current tracker task ID (set during handle execution).
   * @internal
   */
  private _currentTrackerId?: string

  /**
   * Current tenant ID for tracking (set during handle execution).
   * @internal
   */
  private _currentTenantId?: string

  constructor(options?: ShouldQueueOptions<TInput>) {
    if (options?.connector) {
      this.connector = options.connector
    }
    this.basePostUrl = options?.basePostUrl
    this.tracker = options?.tracker
  }

  /**
   * Set the connector for this task.
   * Used by TasksRuntime to inject the connector after construction.
   */
  setConnector(connector: TaskConnector<TInput>): void {
    this.connector = connector
  }

  /**
   * Get the tenant ID from the connector, if set.
   */
  public get tenantId(): string | undefined {
    return this.connector.tenantId
  }

  public getUniqueTaskName(_: TInput): string {
    return `${this.taskName}`
  }

  /**
   * Override to extract owner ID from task payload for re-subscription support.
   * When set, tasks can be queried by owner via tracker.listByOwner().
   *
   * @param taskBody - The task payload
   * @returns Owner ID (e.g., accountId) or undefined
   *
   * @example
   * ```typescript
   * getOwnerId(taskBody: MyTaskProps): string | undefined {
   *   return taskBody.accountId
   * }
   * ```
   */
  public getOwnerId(_taskBody: TInput): string | undefined {
    return undefined
  }

  /**
   * Queue a task for execution.
   * If a tracker is configured, automatically creates a tracked task.
   */
  async queue(taskBody: TInput): Promise<Omit<TaskStatus, 'payload'>> {
    if (!this.connector) {
      throw new Error(
        `[ShouldQueue] No connector set for task "${this.taskName}". ` +
          'Pass a connector in the constructor or call setConnector() before queueing.',
      )
    }

    let trackerId: string | undefined

    // Create tracked task if tracker is available
    if (this.tracker && this.tenantId) {
      trackerId = Ids.nanoId()
      await this.tracker.create({
        id: trackerId,
        tenantId: this.tenantId,
        name: this.taskName,
        ownerId: this.getOwnerId(taskBody),
      })
    }

    // Add tracker ID to payload if tracking
    const trackedPayload: TrackedPayload<TInput> = trackerId
      ? { ...taskBody, [TRACKER_ID_FIELD]: trackerId }
      : taskBody

    const result = await this.connector.queue({
      taskName: this.taskName,
      uniqueTaskName: this.getUniqueTaskName(taskBody),
      postUrl: this.basePostUrl
        ? `${this.basePostUrl}${this.postUrl}`
        : this.postUrl,
      taskBody: trackedPayload,
      handle: this.createTrackedHandle(trackedPayload),
    })

    // Return with tracker ID if available
    return trackerId ? { ...result, id: trackerId } : result
  }

  /**
   * Create a wrapped handle function that integrates with tracker.
   */
  private createTrackedHandle(
    payload: TrackedPayload<TInput>,
  ): () => Promise<TResult> {
    return async () => {
      const trackerId = payload[TRACKER_ID_FIELD]
      const tenantId = this.tenantId

      // Set current context for progress() calls
      this._currentTrackerId = trackerId
      this._currentTenantId = tenantId

      // Clean payload for handle()
      const cleanPayload = { ...payload }
      delete (cleanPayload as TrackedPayload<TInput>)[TRACKER_ID_FIELD]

      // Mark as started
      if (this.tracker && trackerId && tenantId) {
        await this.tracker.start(
          trackerId,
          tenantId,
          `Starting ${this.taskName}`,
        )
      }

      try {
        const result = await this.handle(cleanPayload as TInput)

        // Mark as completed
        if (this.tracker && trackerId && tenantId) {
          await this.tracker.complete(trackerId, tenantId, result)
        }

        return result
      } catch (error) {
        // Mark as failed
        if (this.tracker && trackerId && tenantId) {
          await this.tracker.fail(trackerId, tenantId, error as Error)
        }
        throw error
      } finally {
        // Clear context
        this._currentTrackerId = undefined
        this._currentTenantId = undefined
      }
    }
  }

  /**
   * Report progress during task execution.
   * Call this from within handle() to update progress.
   *
   * @param percent - Progress percentage (0-100)
   * @param message - Optional progress message
   *
   * @example
   * ```typescript
   * async handle(payload: MyPayload) {
   *   await this.progress(25, 'Loading data...')
   *   const data = await loadData()
   *
   *   await this.progress(50, 'Processing...')
   *   const result = process(data)
   *
   *   await this.progress(75, 'Saving...')
   *   await save(result)
   *
   *   return result
   * }
   * ```
   */
  async progress(percent: number, message?: string): Promise<void> {
    if (!this.tracker || !this._currentTrackerId || !this._currentTenantId) {
      return // No-op if not tracking
    }

    await this.tracker.progress(
      this._currentTrackerId,
      this._currentTenantId,
      percent,
      message,
    )
  }

  /**
   * Get task status.
   * If tracker is available and ID matches a tracked task, returns tracker status.
   */
  async getStatus(id: string): Promise<TaskStatus<TInput>> {
    // Try tracker first if available
    if (this.tracker && this.tenantId) {
      const tracked = await this.tracker.get(id, this.tenantId)
      if (tracked) {
        return {
          id: tracked.id,
          name: tracked.name,
          status: tracked.status,
          output: tracked.result ? JSON.stringify(tracked.result) : '',
          attempts: 0,
          created: new Date(tracked.createdAt).toISOString(),
          nextRun: null,
          nextRunMinutes: null,
          payload: {} as TInput,
        }
      }
    }

    // Fall back to connector
    return (await this.connector.getStatus(id)) as TaskStatus<TInput>
  }

  /**
   * Subscribe to task status updates (for SSE).
   * Only works if tracker is configured.
   *
   * @returns Unsubscribe function, or undefined if no tracker
   */
  subscribe(
    taskId: string,
    callback: (state: {
      status: string
      progress: number
      message?: string
    }) => void,
  ): (() => void) | undefined {
    if (!this.tracker || !this.tenantId) {
      return undefined
    }

    return this.tracker.subscribe(taskId, this.tenantId, state => {
      callback({
        status: state.status,
        progress: state.progress,
        message: state.message,
      })
    })
  }

  /**
   * Create a new task instance scoped to a specific tenant.
   * This creates a tenant-scoped connector and returns a new task instance using it.
   *
   * @param tenantId - The tenant identifier for isolation
   * @param credentials - Optional credentials for stronger isolation
   * @returns A new task instance scoped to the tenant, or undefined if not supported
   */
  forTenant(
    tenantId: string,
    credentials?: TenantCredentials,
  ): this | undefined {
    if (!this.connector.forTenant) {
      return undefined
    }

    const tenantConnector = this.connector.forTenant(tenantId, credentials)

    // Create a new instance of the same task class with the tenant connector
    const TenantTask = this.constructor as new (
      opts: ShouldQueueOptions<TInput>,
    ) => this

    return new TenantTask({
      connector: tenantConnector,
      basePostUrl: this.basePostUrl,
      tracker: this.tracker, // Pass tracker to tenant-scoped instance
    })
  }
}

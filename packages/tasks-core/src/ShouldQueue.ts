import type {
  InputType,
  OutputType,
  TaskConnector,
  TaskStatus,
  TenantCredentials,
  UnknownInputType
} from './ShouldQueue.types'

export abstract class ShouldQueue<
  TInput extends InputType = UnknownInputType,
  TResult extends OutputType = undefined
> {
  public abstract readonly taskName: string
  public abstract readonly postUrl: string
  public basePostUrl?: string

  public abstract handle(taskBody: TInput): Promise<TResult>

  public retries = 3
  public connector: TaskConnector<TInput>

  constructor({
    connector,
    basePostUrl
  }: {
    connector: TaskConnector<TInput>
    basePostUrl?: string
  }) {
    this.connector = connector
    this.basePostUrl = basePostUrl
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

  async queue(taskBody: TInput): Promise<Omit<TaskStatus, 'payload'>> {
    return await this.connector.queue({
      taskName: this.taskName,
      uniqueTaskName: this.getUniqueTaskName(taskBody),
      postUrl: this.basePostUrl
        ? `${this.basePostUrl}${this.postUrl}`
        : this.postUrl,
      taskBody,
      handle: this.handle.bind(this)
    })
  }

  async getStatus(id: string): Promise<TaskStatus<TInput>> {
    return (await this.connector.getStatus(id)) as any as TaskStatus<TInput>
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
    credentials?: TenantCredentials
  ): this | undefined {
    if (!this.connector.forTenant) {
      return undefined
    }

    const tenantConnector = this.connector.forTenant(tenantId, credentials)

    // Create a new instance of the same task class with the tenant connector
    const TenantTask = this.constructor as new (opts: {
      connector: TaskConnector<TInput>
      basePostUrl?: string
    }) => this

    return new TenantTask({
      connector: tenantConnector,
      basePostUrl: this.basePostUrl
    })
  }
}

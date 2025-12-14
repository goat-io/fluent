import type {
  InputType,
  OutputType,
  TaskConnector,
  TaskStatus,
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
}

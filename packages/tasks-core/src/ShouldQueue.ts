import { Ids } from '@goatlab/js-utils'
import type {
  InputType,
  OutputType,
  TaskConnector,
  TaskStatus,
  UnknownInputType
} from './ShouldQueue.types'

export abstract class ShouldQueue<
  TInput extends InputType = UnknownInputType,
  TResult extends OutputType = void
> {
  public abstract readonly taskName: string
  public abstract readonly postUrl: string
  public abstract handle(taskBody: TInput): Promise<TResult>

  public retries = 3
  protected connector: TaskConnector<TInput>

  constructor({ connector }: { connector: TaskConnector<TInput> }) {
    this.connector = connector
  }

  protected getUniqueTaskName(_: TInput): string {
    return `${this.taskName}`
  }

  async queue(taskBody: TInput): Promise<Omit<TaskStatus, 'payload'>> {
    return await this.connector.queue({
      taskName: this.getUniqueTaskName(taskBody),
      postUrl: this.postUrl,
      taskBody,
      handle: this.handle.bind(this)
    })
  }

  async getStatus(id: string): Promise<TaskStatus<TInput>> {
    return (await this.connector.getStatus(id)) as any as TaskStatus<TInput>
  }
}

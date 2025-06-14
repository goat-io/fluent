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
  protected abstract taskName: string
  protected abstract postUrl: string
  protected retries = 3
  protected connector: TaskConnector<TInput>

  constructor({ connector }: { connector: TaskConnector<TInput> }) {
    this.connector = connector
  }

  protected abstract handle(taskBody: TInput): Promise<TResult>

  protected getUniqueTaskName(_: TInput): string {
    return `${this.taskName}`
  }

  //   getHatchetTask() {
  //     return hatchet.task({
  //       name: `${env.APP_NAME}-backend-${this.taskName}`,
  //       retries: this.retries,
  //       fn: this.handle.bind(this),
  //     })
  //   }

  async schedule(taskBody: TInput): Promise<Omit<TaskStatus, 'payload'>> {
    return await this.connector.schedule({
      taskName: `${this.getUniqueTaskName(taskBody)}_${Ids.nanoId(5)}`,
      postUrl: this.postUrl,
      taskBody
    })
  }

  async getStatus(id: string): Promise<TaskStatus<TInput>> {
    return (await this.connector.getStatus(id)) as any as TaskStatus<TInput>
    // Only gcp cloud task ids start with "project"
    // if (id.startsWith('project/')) {
    //   const status = await taskQueueService.getStatus(id)
    //   status.name = this.taskName

    //   return status as TaskStatus<TInput>
    // }

    // const { data } = await hatchet.api.v1TaskGet(id)

    // return {
    //   id,
    //   attempts: data.attempt || 1,
    //   payload: (data.input as any).input || {},
    //   status: data.status,
    //   created: data.metadata.createdAt,
    //   name: data.displayName,
    //   nextRun: null,
    //   nextRunMinutes: null,
    //   output: data.output as any,
    // }
  }
}

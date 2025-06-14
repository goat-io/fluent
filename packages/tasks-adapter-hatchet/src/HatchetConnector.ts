import { Memo } from '@goatlab/js-utils'
import type {
  ShouldQueue,
  TaskConnector,
  TaskStatus
} from '@goatlab/tasks-core'
import { Hatchet } from '@hatchet-dev/typescript-sdk'

export class HatchetConnector implements TaskConnector<object> {
  private token: string
  private hostAndPort: string
  private apiUrl: string
  private logLevel: 'INFO' | 'OFF' | 'DEBUG' | 'WARN' | 'ERROR'
  private tenantId: string

  constructor({
    token,
    hostAndPort,
    apiUrl,
    logLevel,
    tenantId
  }: {
    token: string
    hostAndPort?: string
    apiUrl?: string
    logLevel: 'INFO' | 'OFF' | 'DEBUG' | 'WARN' | 'ERROR'
    tenantId?: string
  }) {
    this.token = token || ''
    this.hostAndPort = hostAndPort || 'localhost:7077'
    this.apiUrl = apiUrl || 'http:localhost:8888'
    this.logLevel = logLevel || 'INFO'
    this.tenantId = tenantId || ''
  }

  @Memo.syncMethod()
  public getHatchetClient() {
    const hatchet = Hatchet.init({
      token: this.token,
      host_port: this.hostAndPort || 'localhost:7077',
      api_url: this.apiUrl || 'http://localhost:8888',
      log_level: this.logLevel || 'INFO',
      // This is the default tenantId for local development
      tenant_id: this.tenantId || '707d0855-80ab-4e1f-a156-f1c4546cbf52',
      namespace: '',
      tls_config: {
        tls_strategy: 'none'
      }
    })

    return hatchet
  }

  getHatchetTask(task: ShouldQueue) {
    return this.getHatchetClient().task({
      name: task.taskName,
      retries: task['retries'] || 3,
      fn: task.handle.bind(this)
    })
  }

  /**
   * Gets the status of a task by its name.
   * Implements the TaskConnector interface.
   * @param name - Name of the task.
   */
  async getStatus(id: string): Promise<TaskStatus> {
    const { data } = await this.getHatchetClient().api.v1TaskGet(id)

    return {
      id,
      attempts: data.attempt || 1,
      payload: (data.input as any).input || {},
      status: data.status,
      created: data.metadata.createdAt,
      name: data.actionId.split(':')[0] || '',
      nextRun: null,
      nextRunMinutes: null,
      output: data.output as any
    }
  }

  /**
   * Queues a task to be run in the background.
   * Implements the TaskConnector interface.
   * @param params
   * @param params.taskName - Name of the task.
   * @param params.postUrl - URL to post the task to.
   * @param params.taskBody - Body of the task.
   */
  async queue(params: any): Promise<Omit<TaskStatus, 'payload'>> {
    const hatchet = this.getHatchetClient().task({
      name: params.taskName,
      retries: 3,
      fn: params.handle.bind(this)
    })

    const result = await hatchet.runNoWait(params.taskBody)
    const taskId = await result.runId

    return {
      id: taskId,
      name: result._standaloneTaskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: new Date().toISOString(),
      nextRun: null,
      nextRunMinutes: null
    }
  }
}

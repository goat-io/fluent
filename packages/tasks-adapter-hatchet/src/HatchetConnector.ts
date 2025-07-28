import { Ids, Memo } from '@goatlab/js-utils'
import type {
  ShouldQueue,
  TaskConnector,
  TaskStatus
} from '@goatlab/tasks-core'
import { Hatchet } from '@hatchet-dev/typescript-sdk'

// Default configuration constants
const DEFAULT_HOST_PORT = 'localhost:7077'
const DEFAULT_API_URL = 'http://localhost:8888'
const DEFAULT_LOG_LEVEL = 'INFO'
const DEFAULT_TENANT_ID = '707d0855-80ab-4e1f-a156-f1c4546cbf52'

export class HatchetConnector implements TaskConnector<object> {
  private readonly token: string
  private readonly hostAndPort: string
  private readonly apiUrl: string
  private readonly logLevel: 'INFO' | 'OFF' | 'DEBUG' | 'WARN' | 'ERROR'
  private readonly tenantId: string

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
    this.hostAndPort = hostAndPort || DEFAULT_HOST_PORT
    this.apiUrl = apiUrl || DEFAULT_API_URL
    this.logLevel = logLevel || DEFAULT_LOG_LEVEL
    this.tenantId = tenantId || ''
  }

  @Memo.syncMethod()
  public getHatchetClient() {
    const hatchet = Hatchet.init({
      token: this.token,
      host_port: this.hostAndPort,
      api_url: this.apiUrl,
      log_level: this.logLevel,
      // This is the default tenantId for local development
      tenant_id: this.tenantId || DEFAULT_TENANT_ID,
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
   * Gets the status of a task by its name.
   * Implements the TaskConnector interface.
   * @param name - Name of the task.
   */
  async getStatus(id: string): Promise<TaskStatus> {
    const { data } = await this.getHatchetClient().api.v1TaskGet(id)

    // Extract values once
    const input = data.input as any
    const taskName = data.actionId.split(':')[0] || ''
    
    return {
      id,
      attempts: data.attempt || 1,
      payload: input?.input || {},
      status: data.status,
      created: data.metadata.createdAt,
      name: taskName,
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
    const now = new Date().toISOString()

    return {
      id: taskId,
      name: result._standaloneTaskName,
      output: '',
      attempts: 0,
      status: 'QUEUED',
      created: now,
      nextRun: null,
      nextRunMinutes: null
    }
  }
}

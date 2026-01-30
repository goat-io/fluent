import type { ShouldQueue } from '../ShouldQueue'
import type {
  TaskClass,
  TasksRuntimeConfig,
  TasksRuntimeLogger,
  WorkerManager,
  SchedulerManager,
} from './TasksRuntime.types'
import { WorkerPoolManager } from '../dispatch/WorkerPoolManager'
import { DispatchFanOut } from '../dispatch/DispatchFanOut'
import type { DispatchConnector } from '../dispatch/DispatchConnector'

/**
 * Check whether a value is a class constructor (function) vs an instance.
 */
function isTaskClass(value: unknown): value is TaskClass {
  return typeof value === 'function'
}

export class TasksRuntime {
  private static instance: TasksRuntime | null = null
  private workerManager: WorkerManager | null = null
  private schedulerManager: SchedulerManager | null = null
  private dispatchConnector: DispatchConnector | null = null
  private tasks: ShouldQueue[] = []
  private isRunning = false
  private readonly logger: Required<TasksRuntimeLogger>

  private constructor(private readonly config: TasksRuntimeConfig) {
    const log = config.logger ?? {}
    this.logger = {
      info: log.info ?? console.log.bind(console),
      warn: log.warn ?? console.warn.bind(console),
      error: log.error ?? console.error.bind(console),
      debug: log.debug ?? (() => {}),
    }
  }

  static async start(config: TasksRuntimeConfig): Promise<TasksRuntime> {
    if (TasksRuntime.instance) {
      throw new Error('TasksRuntime already started. Call stop() first.')
    }
    const runtime = new TasksRuntime(config)
    await runtime.initialize()
    TasksRuntime.instance = runtime
    return runtime
  }

  static getInstance(): TasksRuntime | null {
    return TasksRuntime.instance
  }

  private resolveTasks(): ShouldQueue[] {
    const items = this.config.tasks

    if (items.length === 0) return []

    // Check if first element is a class constructor or an instance
    if (isTaskClass(items[0])) {
      // Task classes — instantiate them
      const classes = items as TaskClass[]
      const connector = this.config.createTaskConnector?.()

      return classes.map((TaskCls) => {
        const instance = new TaskCls()
        if (connector) {
          instance.setConnector(connector)
        }
        return instance
      })
    }

    // Already instances
    return items as ShouldQueue[]
  }

  private async initialize(): Promise<void> {
    this.logger.info(`[TasksRuntime] Starting in ${this.config.mode} mode`)

    // Resolve tasks (instantiate from classes if needed)
    this.tasks = this.resolveTasks()
    this.logger.info(`[TasksRuntime] ${this.tasks.length} task(s) registered`)

    if (this.config.mode === 'api-only') {
      this.logger.info('[TasksRuntime] API-only mode: no workers or schedulers')
      this.isRunning = true
      return
    }

    if (this.config.mode === 'isolated') {
      if (this.config.createWorkerManager) {
        this.workerManager = this.config.createWorkerManager(this.tasks)
        await this.workerManager.start()
        this.logger.info('[TasksRuntime] Worker manager started (isolated mode)')
      } else {
        this.logger.warn('[TasksRuntime] Isolated mode but no createWorkerManager provided')
      }
    }

    if (this.config.mode === 'shared') {
      if (this.config.dispatch) {
        this.dispatchConnector = this.config.dispatch.createConnector()
        this.logger.info('[TasksRuntime] Dispatch connector initialized (shared mode)')
      } else {
        this.logger.warn('[TasksRuntime] Shared mode but no dispatch config provided')
      }
    }

    if (this.config.createSchedulerManager) {
      this.schedulerManager = this.config.createSchedulerManager()
      await this.schedulerManager.start()
      this.logger.info('[TasksRuntime] Scheduler manager started')
    }

    this.isRunning = true
    this.logger.info('[TasksRuntime] Initialization complete')
  }

  /**
   * Get the resolved task instances.
   */
  getTasks(): ShouldQueue[] {
    return this.tasks
  }

  getDispatchConnector(): DispatchConnector | null {
    return this.dispatchConnector
  }

  createWorkerPoolManager(): WorkerPoolManager | null {
    if (!this.dispatchConnector || !this.config.dispatch) return null
    const taskRegistry = WorkerPoolManager.createTaskRegistry(this.tasks)
    return new WorkerPoolManager({
      connector: this.dispatchConnector,
      dispatchConfig: this.config.dispatch.config,
      taskRegistry,
      executeTask: async (tenantId, queueName, jobData) => {
        const task = taskRegistry.get(queueName)
        if (!task) throw new Error(`No handler for queue: ${queueName}`)
        return task.handle(jobData as any)
      },
      logger: this.config.logger ? {
        info: this.config.logger.info ?? (() => {}),
        warn: this.config.logger.warn ?? (() => {}),
        error: this.config.logger.error ?? (() => {}),
        debug: this.config.logger.debug ?? (() => {}),
      } : undefined,
    })
  }

  createDispatchFanOut(): DispatchFanOut | null {
    if (!this.dispatchConnector || !this.config.dispatch) return null
    return new DispatchFanOut({
      connector: this.dispatchConnector,
      config: this.config.dispatch.config,
      logger: this.config.logger ? {
        info: this.config.logger.info ?? (() => {}),
        warn: this.config.logger.warn ?? (() => {}),
        error: this.config.logger.error ?? (() => {}),
        debug: this.config.logger.debug ?? (() => {}),
      } : undefined,
    })
  }

  get running(): boolean { return this.isRunning }
  get mode(): string { return this.config.mode }

  async stop(): Promise<void> {
    if (!this.isRunning) return
    this.logger.info('[TasksRuntime] Stopping...')
    if (this.workerManager) { await this.workerManager.stop(); this.workerManager = null }
    if (this.schedulerManager) { await this.schedulerManager.stop(); this.schedulerManager = null }
    if (this.dispatchConnector) { await this.dispatchConnector.close(); this.dispatchConnector = null }
    this.isRunning = false
    TasksRuntime.instance = null
    this.logger.info('[TasksRuntime] Stopped')
  }
}

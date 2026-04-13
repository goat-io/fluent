import type { ShouldQueue } from '../ShouldQueue'
import type { InputType, TaskConnector } from '../ShouldQueue.types'
import type {
  ListenHandle,
  ListenInput,
  ListenTaskConfig,
  TaskQueueInput,
  TaskRegistryOptions,
  ToInstances,
} from './TaskRegistry.types'
import { snakeToCamelCase } from './TaskRegistry.types'

/**
 * Typed task registry that provides a dispatch-aware queue API.
 *
 * Usage:
 * ```typescript
 * // Preferred: instantiate from classes (return type inferred from taskClasses)
 * const tasks = TaskRegistry.fromClasses(
 *   taskClasses,
 *   queueService.getBullMQ(),
 *   { tenantId: id, writeDispatchHint: ..., logger },
 * )
 *
 * // Type-safe queueing with autocomplete:
 * await tasks.queue({ processPost: { postId: '123' } })
 *
 * // Multiple tasks at once:
 * await tasks.queue({
 *   processPost: { postId: '123' },
 *   sendMessage: { chatId: 'abc', content: 'Hello' },
 * })
 * ```
 */
export class TaskRegistry<
  TTasks extends readonly ShouldQueue<any, any, any>[] = ShouldQueue<
    any,
    any,
    any
  >[],
> {
  /**
   * Internal lookup: camelCase key -> task instance.
   */
  private readonly taskMap: Map<string, ShouldQueue<any, any, any>>

  /**
   * Internal lookup: snake_case taskName -> task instance.
   * For get() by original name.
   */
  private readonly tasksByName: Map<string, ShouldQueue<any, any, any>>

  private readonly connector: TaskConnector<any>

  private readonly logger: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }

  constructor(
    tasks: TTasks,
    connector: TaskConnector<any>,
    options: TaskRegistryOptions = {},
  ) {
    this.connector = connector
    const l = options.logger
    this.logger = {
      info: l?.info?.bind(l) ?? console.log.bind(console),
      warn: l?.warn?.bind(l) ?? console.warn.bind(console),
      error: l?.error?.bind(l) ?? console.error.bind(console),
      debug: l?.debug?.bind(l) ?? (() => {}),
    }

    this.taskMap = new Map()
    this.tasksByName = new Map()

    for (const task of tasks) {
      const camelKey = snakeToCamelCase(task.taskName)
      this.taskMap.set(camelKey, task)
      this.tasksByName.set(task.taskName, task)
    }

    this.logger.debug(`[TaskRegistry] Registered ${tasks.length} task(s):`, [
      ...this.taskMap.keys(),
    ])
  }

  /**
   * Factory: create a TaskRegistry by instantiating task classes.
   *
   * Each class is `new`-ed, then `setConnector(connector)` is called
   * so the instances are ready for `queue()`.
   *
   * The return type is inferred from the classes tuple:
   * ```typescript
   * const tasks = TaskRegistry.fromClasses({
   *   classes: taskClasses,
   *   connector: queueService.getBullMQ(),
   *   options: { tenantId, writeDispatchHint, logger },
   * })
   * //  ^? TaskRegistry<[ProcessPostTask, SendMessageTask, ...]>
   * ```
   */
  static fromClasses<
    TClasses extends readonly (new (
      ...args: any[]
    ) => ShouldQueue<any, any, any>)[],
  >(params: {
    classes: TClasses
    connector: TaskConnector<any>
    options?: TaskRegistryOptions
  }): TaskRegistry<ToInstances<TClasses>> {
    const { classes, connector, options = {} } = params
    const instances = classes.map(Cls => {
      const instance = new Cls()
      instance.setConnector(connector)
      return instance
    }) as unknown as ToInstances<TClasses>
    return new TaskRegistry<ToInstances<TClasses>>(
      instances,
      connector,
      options,
    )
  }

  /**
   * Queue one or more tasks by camelCase name.
   *
   * Queues each task via the connector and optionally writes dispatch hints.
   *
   * @param input - Object with camelCase task keys and their payloads
   * @returns Object mapping each queued task key to its job ID
   *
   * @throws Error if a task key is not found in the registry
   */
  async queue(
    input: TaskQueueInput<TTasks>,
  ): Promise<Record<string, { id: string }>> {
    const entries = Object.entries(input as Record<string, InputType>)

    if (entries.length === 0) {
      return {}
    }

    const results: Record<string, { id: string }> = {}

    for (const [camelKey, payload] of entries) {
      if (payload === undefined) {
        continue
      }

      const task = this.taskMap.get(camelKey)
      if (!task) {
        throw new Error(
          `[TaskRegistry] Unknown task: "${camelKey}". ` +
            `Available: ${[...this.taskMap.keys()].join(', ')}`,
        )
      }

      const uniqueTaskName = task.getUniqueTaskName?.(payload) || task.taskName
      const result = await this.connector.queue({
        uniqueTaskName,
        taskName: task.taskName,
        postUrl: '',
        taskBody: payload as object,
        handle: async () => task.handle(payload),
      })

      results[camelKey] = { id: result.id }
    }

    return results
  }

  /**
   * Execute one or more task handlers directly by camelCase name.
   *
   * Same typed API as `queue()`, but calls `handle()` directly
   * instead of enqueueing via the connector.
   *
   * @param input - Object with camelCase task keys and their payloads
   * @returns Object mapping each handled task key to its result
   *
   * @throws Error if a task key is not found in the registry
   */
  async handle(
    input: TaskQueueInput<TTasks>,
  ): Promise<Record<string, unknown>> {
    const entries = Object.entries(input as Record<string, InputType>)

    if (entries.length === 0) {
      return {}
    }

    const results: Record<string, unknown> = {}

    for (const [camelKey, payload] of entries) {
      if (payload === undefined) {
        continue
      }

      const task = this.taskMap.get(camelKey)
      if (!task) {
        throw new Error(
          `[TaskRegistry] Unknown task: "${camelKey}". ` +
            `Available: ${[...this.taskMap.keys()].join(', ')}`,
        )
      }

      results[camelKey] = await task.handle(payload)
    }

    return results
  }

  /**
   * Execute a task handler by its snake_case taskName.
   *
   * Designed for dispatch, where the task name and payload are
   * runtime values from the dispatch hint / job data.
   *
   * @param name - snake_case task name (e.g., 'process_post')
   * @param data - The job payload
   * @returns The task handler's result
   *
   * @throws Error if no task is registered with that name
   */
  async handleByName(name: string, data: unknown): Promise<unknown> {
    const task = this.tasksByName.get(name)
    if (!task) {
      throw new Error(
        `[TaskRegistry] Unknown task: "${name}". ` +
          `Available: ${[...this.tasksByName.keys()].join(', ')}`,
      )
    }
    return task.handle(data as any)
  }

  /**
   * Start persistent workers that consume jobs from queues for selected tasks.
   *
   * Completes the TaskRegistry API surface:
   * - `queue()` → enqueue a task
   * - `handle()` → execute a task directly
   * - `listen()` → consume tasks from queue
   *
   * @param input - Object selecting which tasks to listen to (omit for all)
   * @param options - Global defaults (e.g., default concurrency)
   * @returns Handle to stop the workers and check running status
   *
   * @example
   * ```typescript
   * // Listen to specific tasks
   * const handle = await tasks.listen({ processPost: { concurrency: 10 } })
   *
   * // Listen to all registered tasks
   * const handle = await tasks.listen()
   *
   * // Stop listening
   * await handle.stop()
   * ```
   *
   * @throws Error if connector does not support listen()
   * @throws Error if a task key is not found in the registry
   */
  async listen(
    input?: ListenInput<TTasks>,
    options?: { concurrency?: number },
  ): Promise<ListenHandle> {
    if (!this.connector.listen) {
      throw new Error('[TaskRegistry] Connector does not support listen()')
    }

    // If no input, listen to ALL tasks
    const entries: [string, ListenTaskConfig][] = input
      ? (Object.entries(input as Record<string, ListenTaskConfig>).filter(
          ([_, v]) => v !== undefined,
        ) as [string, ListenTaskConfig][])
      : [...this.taskMap.keys()].map(k => [k, true as const])

    const tasksToListen = entries.map(([camelKey, config]) => {
      const task = this.taskMap.get(camelKey)
      if (!task) {
        throw new Error(
          `[TaskRegistry] Unknown task: "${camelKey}". ` +
            `Available: ${[...this.taskMap.keys()].join(', ')}`,
        )
      }
      return {
        taskName: task.taskName,
        handle: (data: unknown) => task.handle(data as any),
        concurrency:
          typeof config === 'object' ? config.concurrency : undefined,
      }
    })

    this.logger.debug(
      `[TaskRegistry] Starting listeners for:`,
      tasksToListen.map(t => t.taskName),
    )

    return this.connector.listen({
      tasks: tasksToListen,
      defaultConcurrency: options?.concurrency,
    })
  }

  /**
   * Get a task instance by its camelCase key.
   *
   * @param key - camelCase task key (e.g., 'processPost')
   * @returns The task instance or undefined
   */
  get(key: string): ShouldQueue<any, any, any> | undefined {
    return this.taskMap.get(key)
  }

  /**
   * Get a task instance by its original snake_case taskName.
   *
   * @param name - snake_case task name (e.g., 'process_post')
   * @returns The task instance or undefined
   */
  getByName(name: string): ShouldQueue<any, any, any> | undefined {
    return this.tasksByName.get(name)
  }

  /**
   * Get all registered camelCase keys.
   */
  keys(): string[] {
    return [...this.taskMap.keys()]
  }

  /**
   * Get all registered task instances.
   */
  tasks(): ShouldQueue<any, any, any>[] {
    return [...this.taskMap.values()]
  }

  /**
   * Number of registered tasks.
   */
  get size(): number {
    return this.taskMap.size
  }
}

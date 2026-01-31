import type { ShouldQueue } from '../ShouldQueue'
import type { InputType } from '../ShouldQueue.types'
import type { TaskQueueInput, TaskRegistryConfig } from './TaskRegistry.types'
import { snakeToCamelCase } from './TaskRegistry.types'

/**
 * Typed task registry that provides a dispatch-aware queue API.
 *
 * Usage:
 * ```typescript
 * const tasks = runtime.createTaskRegistry<typeof myTasks>({
 *   getTenantId: () => container.context.tenantMeta.id,
 *   queueFn: async ({ task, payload, tenantId }) => { ... },
 *   writeDispatchHint: async ({ tenantId, taskName, jobId }) => { ... },
 * })
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
  TTasks extends readonly ShouldQueue<any, any, any>[] = ShouldQueue<any, any, any>[],
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

  private readonly config: TaskRegistryConfig

  private readonly logger: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }

  constructor(
    tasks: TTasks,
    config: TaskRegistryConfig = {},
    logger?: {
      info?: (...args: unknown[]) => void
      warn?: (...args: unknown[]) => void
      error?: (...args: unknown[]) => void
      debug?: (...args: unknown[]) => void
    },
  ) {
    this.config = config
    this.logger = {
      info: logger?.info ?? console.log.bind(console),
      warn: logger?.warn ?? console.warn.bind(console),
      error: logger?.error ?? console.error.bind(console),
      debug: logger?.debug ?? (() => {}),
    }

    this.taskMap = new Map()
    this.tasksByName = new Map()

    for (const task of tasks) {
      const camelKey = snakeToCamelCase(task.taskName)
      this.taskMap.set(camelKey, task)
      this.tasksByName.set(task.taskName, task)
    }

    this.logger.debug(
      `[TaskRegistry] Registered ${tasks.length} task(s):`,
      [...this.taskMap.keys()],
    )
  }

  /**
   * Queue one or more tasks by camelCase name.
   *
   * Automatically:
   * 1. Resolves the current tenant from getTenantId()
   * 2. Queues each task via queueFn()
   * 3. Writes dispatch hints via writeDispatchHint() (if provided, non-fatal on failure)
   *
   * @param input - Object with camelCase task keys and their payloads
   * @returns Object mapping each queued task key to its job ID
   *
   * @throws Error if getTenantId is not configured
   * @throws Error if queueFn is not configured
   * @throws Error if a task key is not found in the registry
   */
  async queue(
    input: TaskQueueInput<TTasks>,
  ): Promise<Record<string, { id: string }>> {
    const entries = Object.entries(input as Record<string, InputType>)

    if (entries.length === 0) {
      return {}
    }

    if (!this.config.getTenantId) {
      throw new Error(
        '[TaskRegistry] getTenantId callback not configured. ' +
        'Cannot queue tasks without tenant context.',
      )
    }

    if (!this.config.queueFn) {
      throw new Error(
        '[TaskRegistry] queueFn callback not configured. ' +
        'Cannot queue tasks without a queue function.',
      )
    }

    const tenantId = this.config.getTenantId()
    const results: Record<string, { id: string }> = {}

    for (const [camelKey, payload] of entries) {
      if (payload === undefined) continue

      const task = this.taskMap.get(camelKey)
      if (!task) {
        throw new Error(
          `[TaskRegistry] Unknown task key: "${camelKey}". ` +
          `Available keys: ${[...this.taskMap.keys()].join(', ')}`,
        )
      }

      // Step 1: Queue to tenant queue
      const result = await this.config.queueFn({
        task,
        payload,
        tenantId,
      })

      results[camelKey] = result

      // Step 2: Write dispatch hint (non-fatal)
      if (this.config.writeDispatchHint) {
        try {
          await this.config.writeDispatchHint({
            tenantId,
            taskName: task.taskName,
            jobId: result.id,
          })
          this.logger.debug('[TaskRegistry] Dispatch hint written', {
            tenantId,
            taskName: task.taskName,
            jobId: result.id,
          })
        } catch (error) {
          // Dispatch hint failure is NOT fatal.
          // The job is already in the tenant queue (source of truth).
          // The reconciler will catch orphaned jobs.
          this.logger.warn('[TaskRegistry] Failed to write dispatch hint (non-fatal)', {
            taskName: task.taskName,
            jobId: result.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    return results
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

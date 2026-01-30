import type { DispatchCycleResult, DispatchConfig } from './dispatch.types'
import type { DispatchConnector } from './DispatchConnector'
import type { ShouldQueue } from '../ShouldQueue'

/**
 * Task registry: maps task names to their handler instances.
 */
export type TaskRegistry = Map<string, ShouldQueue>

/**
 * Logger interface for WorkerPoolManager.
 * If not provided, falls back to console.
 */
export interface WorkerPoolManagerLogger {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

export interface WorkerPoolManagerConfig {
  /** The dispatch connector (BullMQ, GCP, etc.) */
  connector: DispatchConnector
  /** Dispatch configuration (time budget, batch size, etc.) */
  dispatchConfig: DispatchConfig
  /** Task registry for resolving task handlers by name */
  taskRegistry: TaskRegistry
  /** Callback to execute a task with tenant context */
  executeTask: (tenantId: string, queueName: string, jobData: unknown) => Promise<unknown>
  /** Optional logger (defaults to console) */
  logger?: WorkerPoolManagerLogger
}

/**
 * Processes dispatch hint batches within a time budget.
 *
 * Replaces per-tenant Workers with a fixed-size dispatcher that:
 * 1. Reads dispatch hints from the global queue (priority-ordered)
 * 2. Manually fetches the actual job from the tenant queue
 * 3. Bootstraps tenant context and executes the job handler
 * 4. Moves the job to completed/failed
 *
 * Runs within a single HTTP request's lifecycle (Cloud Run).
 * Time budget ensures the request completes before lock expiry (30s).
 */
export class WorkerPoolManager {
  private readonly connector: DispatchConnector
  private readonly config: DispatchConfig
  private readonly taskRegistry: TaskRegistry
  private readonly executeTask: (tenantId: string, queueName: string, jobData: unknown) => Promise<unknown>
  private readonly logger: WorkerPoolManagerLogger

  constructor(managerConfig: WorkerPoolManagerConfig) {
    this.connector = managerConfig.connector
    this.config = managerConfig.dispatchConfig
    this.taskRegistry = managerConfig.taskRegistry
    this.executeTask = managerConfig.executeTask
    this.logger = managerConfig.logger || console
  }

  /**
   * Process a batch of dispatch hints within the time budget.
   * Returns the number of jobs processed.
   *
   * This is called once per HTTP dispatch request.
   * The time budget (default 25s) ensures we finish before
   * BullMQ's default lock duration (30s) expires.
   */
  async processBatch(): Promise<DispatchCycleResult> {
    const timeBudgetMs = this.config.timeBudgetMs || 25000
    const batchSize = this.config.batchSize || 50
    const startTime = Date.now()

    let processed = 0
    let skipped = 0
    let failed = 0

    this.logger.debug('[Dispatch] Starting batch processing', {
      timeBudgetMs,
      batchSize,
    })

    while (
      processed + skipped + failed < batchSize &&
      Date.now() - startTime < timeBudgetMs
    ) {
      try {
        // Fetch next dispatch hint (priority-ordered)
        const hint = await this.connector.fetchNextHint()

        if (!hint) {
          // No more work available
          this.logger.debug('[Dispatch] No more hints available, ending batch')
          break
        }

        // Look up the task handler
        const task = this.taskRegistry.get(hint.queueName)

        if (!task) {
          this.logger.warn('[Dispatch] No handler for queue, skipping', {
            queueName: hint.queueName,
            tenantId: hint.tenantId,
          })
          skipped++
          continue
        }

        // Process the hint: fetch job from tenant queue and execute
        const wasProcessed = await this.connector.processHint(
          hint,
          async (tenantId: string, queueName: string, jobData: unknown) => {
            // Execute with tenant context via callback
            return this.executeTask(tenantId, queueName, jobData)
          },
        )

        if (wasProcessed) {
          processed++
        } else {
          // Hint was stale (job already processed or removed)
          skipped++
        }
      } catch (error) {
        failed++
        this.logger.error('[Dispatch] Error processing dispatch hint', {
          error: error instanceof Error ? error.message : String(error),
        })
        // Continue processing -- one failure shouldn't stop the batch
      }
    }

    const durationMs = Date.now() - startTime

    this.logger.info('[Dispatch] Batch complete', {
      processed,
      skipped,
      failed,
      durationMs,
      timeBudgetMs,
    })

    return { processed, skipped, failed, durationMs }
  }

  /**
   * Create a task registry from an array of task instances.
   * Maps taskName -> task instance for lookup during dispatch.
   */
  static createTaskRegistry(tasks: ShouldQueue[]): TaskRegistry {
    const registry = new Map<string, ShouldQueue>()
    for (const task of tasks) {
      registry.set(task.taskName, task)
    }
    return registry
  }
}

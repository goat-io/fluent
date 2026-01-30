/**
 * Multi-Tenant Worker Manager
 *
 * Manages BullMQ workers for all tenants in a single backend instance.
 * Each tenant gets their own queue prefix, but all jobs are processed
 * by shared workers with per-job tenant context bootstrapping.
 *
 * Architecture:
 * - One shared backend instance serves ALL tenants (API + workers)
 * - Each tenant's jobs are isolated by Redis key prefix: tenant:{tenantId}:bull:*
 * - Before processing each job, the tenant context is bootstrapped via executeTask callback
 * - Tasks execute with full tenant isolation (separate DB, secrets, etc.)
 */

import type { ShouldQueue } from '@goatlab/tasks-core'
import type { Worker } from 'bullmq'
import { BullMQConnector, type BullMQConnectionOptions } from './BullMQConnector'

/**
 * Configuration for the multi-tenant worker manager
 */
export interface MultiTenantWorkerManagerConfig {
  /** Tasks to register with each worker */
  tasks: ShouldQueue[]
  /** Concurrency per tenant (default: 10) */
  concurrencyPerTenant?: number
  /** Worker name prefix */
  workerNamePrefix?: string
  /** Callback to list all active tenants */
  listActiveTenants: () => Promise<Array<{ id: string }>>
  /** Callback to get Redis URL for a specific tenant */
  getTenantRedisUrl: (tenantId: string) => Promise<string | null>
  /** Callback to execute a task with tenant context */
  executeTask: (tenantId: string, task: ShouldQueue, jobData: unknown) => Promise<any>
  /** Callback to parse Redis URL into BullMQ connection options */
  parseRedisUrl: (url: string) => BullMQConnectionOptions
  /** Optional logger */
  logger?: {
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
    debug: (...args: any[]) => void
  }
}

/**
 * Wraps a task's handle method to bootstrap tenant context before execution.
 *
 * This ensures that when a job runs:
 * 1. The tenant context is bootstrapped (via executeTask callback)
 * 2. Services use that tenant's resources
 * 3. The context is cleaned up after execution
 */
function wrapTaskWithTenantContext(
  task: ShouldQueue,
  tenantId: string,
  executeTask: (tenantId: string, task: ShouldQueue, jobData: unknown) => Promise<unknown>,
  logger?: MultiTenantWorkerManagerConfig['logger'],
): ShouldQueue {
  const originalHandle = task.handle.bind(task)

  // Create a wrapped task that bootstraps context before execution
  const wrappedTask = Object.create(task) as ShouldQueue

  wrappedTask.handle = async (jobData: any) => {
    logger?.debug(`[Worker] Processing job for tenant: ${tenantId}`, {
      taskName: task.taskName,
      tenantId,
    })

    try {
      // Execute the task with tenant context via callback
      await executeTask(tenantId, task, jobData)
      return undefined
    } catch (error) {
      logger?.error(`[Worker] Job failed for tenant: ${tenantId}`, {
        taskName: task.taskName,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return wrappedTask
}

/**
 * Multi-Tenant Worker Manager
 *
 * Manages workers for all active tenants in a single process.
 */
export class MultiTenantWorkerManager {
  private workers: Map<string, Worker[]> = new Map()
  private connectors: Map<string, BullMQConnector> = new Map()
  private isRunning = false
  private readonly logger: MultiTenantWorkerManagerConfig['logger']

  constructor(private readonly config: MultiTenantWorkerManagerConfig) {
    this.logger = config.logger
  }

  /**
   * Start workers for all active tenants
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger?.warn('[MultiTenantWorker] Already running')
      return
    }

    const tenants = await this.config.listActiveTenants()

    if (tenants.length === 0) {
      this.logger?.warn('[MultiTenantWorker] No active tenants found')
      return
    }

    this.logger?.info(
      `[MultiTenantWorker] Starting workers for ${tenants.length} tenants: ${tenants.map(t => t.id).join(', ')}`,
    )

    const concurrency = this.config.concurrencyPerTenant ?? 10
    const workerPrefix = this.config.workerNamePrefix ?? 'shared-worker'

    // Start workers for each tenant
    for (const tenant of tenants) {
      try {
        await this.startWorkerForTenant(tenant, concurrency, workerPrefix)
      } catch (error) {
        this.logger?.error(
          `[MultiTenantWorker] Failed to start worker for tenant: ${tenant.id}`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        )
        // Continue with other tenants
      }
    }

    this.isRunning = true
    this.logger?.info(`[MultiTenantWorker] All workers started`)
  }

  /**
   * Start workers for a specific tenant
   */
  private async startWorkerForTenant(
    tenant: { id: string },
    concurrency: number,
    workerPrefix: string,
  ): Promise<void> {
    const tenantPrefix = `tenant:${tenant.id}`

    // Resolve this tenant's Redis URL via callback
    const redisUrl = await this.config.getTenantRedisUrl(tenant.id)

    if (!redisUrl) {
      this.logger?.warn(
        `[MultiTenantWorker] No Redis URL for tenant: ${tenant.id}, skipping worker`,
      )
      return
    }

    // Create tenant-scoped connector with tenant's own Redis URL
    const connector = new BullMQConnector({
      connection: this.config.parseRedisUrl(redisUrl),
      tenantId: tenantPrefix,
    })

    this.connectors.set(tenant.id, connector)

    // Wrap tasks with tenant context
    const wrappedTasks = this.config.tasks.map(task =>
      wrapTaskWithTenantContext(task, tenant.id, this.config.executeTask, this.logger),
    )

    // Start worker for this tenant
    const tenantWorkers = await connector.startWorker({
      workerName: `${workerPrefix}-${tenant.id}`,
      tasks: wrappedTasks,
      concurrency,
    })

    // Cast needed: BullMQConnector resolves Worker from @goatlab linked node_modules
    // while consumers may import Worker from their own node_modules. Same type, different paths.
    this.workers.set(tenant.id, tenantWorkers as unknown as Worker[])

    this.logger?.info(`[MultiTenantWorker] Started worker for tenant: ${tenant.id}`, {
      queuePrefix: tenantPrefix,
      concurrency,
      taskCount: wrappedTasks.length,
    })
  }

  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.logger?.info('[MultiTenantWorker] Stopping all workers...')

    // Close all connectors (which closes their workers)
    for (const [tenantId, connector] of this.connectors) {
      try {
        await connector.close()
        this.logger?.debug(
          `[MultiTenantWorker] Stopped worker for tenant: ${tenantId}`,
        )
      } catch (error) {
        this.logger?.error(
          `[MultiTenantWorker] Error stopping worker for tenant: ${tenantId}`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        )
      }
    }

    this.workers.clear()
    this.connectors.clear()
    this.isRunning = false

    this.logger?.info('[MultiTenantWorker] All workers stopped')
  }

  /**
   * Get the number of active workers
   */
  getWorkerCount(): number {
    let count = 0
    for (const workers of this.workers.values()) {
      count += workers.length
    }
    return count
  }

  /**
   * Get the list of tenant IDs with active workers
   */
  getActiveTenants(): string[] {
    return Array.from(this.workers.keys())
  }
}

/**
 * Create and start a multi-tenant worker manager
 */
export async function createMultiTenantWorkerManager(
  config: MultiTenantWorkerManagerConfig,
): Promise<MultiTenantWorkerManager> {
  const manager = new MultiTenantWorkerManager(config)
  await manager.start()
  return manager
}

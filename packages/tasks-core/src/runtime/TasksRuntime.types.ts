import type { ShouldQueue, ShouldQueueOptions } from '../ShouldQueue'
import type { TaskConnector } from '../ShouldQueue.types'
import type { DispatchConfig } from '../dispatch/dispatch.types'
import type { DispatchConnector } from '../dispatch/DispatchConnector'

export interface TasksRuntimeLogger {
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
  debug?: (...args: unknown[]) => void
}

export interface WorkerManager {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface SchedulerManager {
  start(): Promise<void>
  stop(): Promise<void>
}

/**
 * A task class constructor.
 * Accepts optional ShouldQueueOptions (connector injected by TasksRuntime).
 */
export type TaskClass = new (opts?: ShouldQueueOptions<any>) => ShouldQueue

export interface TasksRuntimeConfig {
  mode: 'api-only' | 'isolated' | 'shared'

  /**
   * Tasks to manage. Accepts either:
   * - Pre-instantiated ShouldQueue instances (legacy)
   * - Task class constructors (preferred — TasksRuntime handles instantiation)
   */
  tasks: ShouldQueue[] | TaskClass[]

  /**
   * Factory to create a TaskConnector for task instances.
   * Required when passing task classes. TasksRuntime calls this once
   * and injects the connector into each instantiated task.
   */
  createTaskConnector?: () => TaskConnector<any>

  dispatch?: {
    config: DispatchConfig
    createConnector: () => DispatchConnector
  }
  createWorkerManager?: (tasks: ShouldQueue[]) => WorkerManager
  createSchedulerManager?: () => SchedulerManager
  logger?: TasksRuntimeLogger
}

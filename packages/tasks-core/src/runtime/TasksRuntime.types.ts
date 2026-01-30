import type { ShouldQueue } from '../ShouldQueue'
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

export interface TasksRuntimeConfig {
  mode: 'api-only' | 'isolated' | 'shared'
  tasks: ShouldQueue[]
  dispatch?: {
    config: DispatchConfig
    createConnector: () => DispatchConnector
  }
  createWorkerManager?: () => WorkerManager
  createSchedulerManager?: () => SchedulerManager
  logger?: TasksRuntimeLogger
}

// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type { Kysely } from 'kysely'
import type { TaskConnector, TaskTracker } from '@goatlab/tasks-core'
import type { Database } from '../entities/Database.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type { StepInterceptor, WorkflowDefinition } from '../workflow/WorkflowBuilder.types.js'

export interface WorkflowEngineConfig {
  db: Kysely<Database>
  connector: TaskConnector<object>
  tracker?: TaskTracker
  executors: Map<string, StepExecutor>
  workflows: Map<string, WorkflowDefinition>
  tenantId: string
  interceptors?: StepInterceptor[]
  disableLogBuffering?: boolean
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

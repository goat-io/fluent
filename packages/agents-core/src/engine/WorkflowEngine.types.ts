// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type { Kysely } from 'kysely'
import type { TaskConnector, TaskTracker } from '@goatlab/tasks-core'
import type { Database } from '../entities/Database.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type { StepInterceptor, WorkflowDefinition } from '../workflow/WorkflowBuilder.types.js'
import type { RateLimitConfig } from './ExternalActionExecutor.js'
import type { RateLimiterBackend } from './RateLimiterBackend.js'
import type { IntegrationRegistry } from '../integrations/IntegrationRegistry.js'
import type { EventIngestionService } from '../events/EventIngestion.js'

export interface WorkflowBudget {
  /** Max total tokens across all steps in a workflow run */
  maxTokens?: number
  /** Max total cost in USD across all steps */
  maxCostUsd?: number
  /** Max number of step completions per run */
  maxSteps?: number
  /** Max number of task executions per run (for task_runner steps) */
  maxTaskExecutions?: number
}

export interface BudgetUsed {
  tokens: number
  costUsd: number
  steps: number
  taskExecutions: number
}

export interface WorkflowEngineConfig {
  db: Kysely<Database>
  /** Raw pg.Pool for COPY FROM bulk inserts (optional, enables startBatchCopy) */
  pgPool?: any
  connector: TaskConnector<object>
  tracker?: TaskTracker
  executors: Map<string, StepExecutor>
  workflows: Map<string, WorkflowDefinition>
  tenantId: string
  interceptors?: StepInterceptor[]
  disableLogBuffering?: boolean
  /**
   * Disable batched step-status writes. Default: false (batching enabled
   * when pgPool is set). Useful for tests that need synchronous PG visibility.
   */
  disableStepStatusBuffering?: boolean
  /** Rate limits for external action providers */
  rateLimits?: Record<string, RateLimitConfig>
  /** Max concurrent external calls per workflow run (default: 5) */
  maxConcurrentPerWorkflow?: number
  /** Pluggable rate limiter backend (default: InMemoryRateLimiter) */
  rateLimiterBackend?: RateLimiterBackend
  /** Typed integration registry (GitHub, Linear, Slack, etc.) */
  integrations?: IntegrationRegistry
  /** Event ingestion service for trigger-based workflow starts */
  eventIngestion?: EventIngestionService
  /** Max concurrent steps (RUNNING or QUEUED) per workflow run */
  maxConcurrentStepsPerWorkflow?: number
  /** Default budget guardrails for all workflow runs */
  defaultBudget?: WorkflowBudget
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

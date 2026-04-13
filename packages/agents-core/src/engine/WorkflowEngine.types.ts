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
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

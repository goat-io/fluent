// npx vitest run src/__tests__/engine/lifecycle.spec.ts

import type { TaskConnector, TaskTracker } from '@goatlab/tasks-core'
import type { DbClient } from '../db/DbClient.js'
import type { EventIngestionService } from '../events/EventIngestion.js'
import type { IntegrationRegistry } from '../integrations/IntegrationRegistry.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type {
  StepInterceptor,
  WorkflowDefinition,
} from '../workflow/WorkflowBuilder.types.js'
import type { EngineEvent } from './EngineEvent.types.js'
import type { RateLimitConfig } from './ExternalActionExecutor.js'
import type { RateLimiterBackend } from './RateLimiterBackend.js'

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
  db: DbClient
  /** Raw pg.Pool for COPY FROM bulk inserts (optional, enables startBatchCopy) */
  pgPool?: any
  /**
   * Task dispatch connector. When omitted, step dispatch is a no-op —
   * PgConnector handles dispatch via polling, so the step row in PG
   * (status='QUEUED') IS the queue. Most workflows don't need Redis.
   */
  connector?: TaskConnector<object>
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
  /**
   * Optional hook invoked after every engine state transition COMMITS to PG.
   *
   * Critical contract: this hook fires AFTER the corresponding PG write has
   * been committed. Subscribers can immediately query workflow_runs / steps
   * and see the new state — no race window.
   *
   * Hook is fire-and-forget from the engine's POV (engine doesn't await it).
   * If your hook throws, the engine catches and logs — never propagates.
   * Keep the hook cheap; for I/O (Redis publish, etc.) push to an in-memory
   * queue and drain on a separate flush.
   *
   * Use cases:
   *   - SSE / WebSocket fan-out (publish via your realtime broker)
   *   - Audit logging (push to log shipping pipeline)
   *   - Metrics (counter increment per event type)
   *   - Webhooks (push to a delivery queue; never call HTTP synchronously here)
   */
  onEngineEvent?: (evt: EngineEvent) => void

  /**
   * Postgres schema for engine tables. Default: `public` (no schema prefix).
   * Use this to isolate engine tables from your domain tables — e.g.
   * `agents.workflow_runs` instead of `public.workflow_runs`.
   *
   * In Prisma, set `@@schema("agents")` on each engine model and enable
   * `previewFeatures = ["multiSchema"]`. Migrations apply normally.
   *
   * Use Postgres schemas instead of per-table prefixes — same isolation,
   * far simpler implementation, and natural Prisma support.
   */
  schema?: string
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
  /** DBOS-parity: application version stamped on new workflow runs */
  applicationVersion?: string
  /**
   * Rollback handlers for saga-style compensation. Keyed by
   * `<workflowName>.<stepName>` — same namespace as step handlers.
   * Registered automatically by `createEngine` when a Step has `rollback()`.
   */
  rollbackHandlers?: Map<
    string,
    (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>
  >
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

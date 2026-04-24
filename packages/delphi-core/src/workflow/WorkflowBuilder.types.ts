// npx vitest run src/__tests__/state-machine.spec.ts
import type { JsonObject, JsonValue } from '@goatlab/tasks-core'
import type { IANATimezone } from '../scheduler/timezones.js'

// ── Workflow Status ────────────────────────────────────────────────

export type WorkflowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DELAYED'

export type StepStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'WAITING_HUMAN'
  | 'SLEEPING'

// ── Step Context ───────────────────────────────────────────────────

export interface StepContext {
  workflowRunId: string
  tenantId: string
  completedOutputs: Record<string, JsonObject>
  triggerInput: JsonObject
  /** Task results from upstream steps, keyed by stepName */
  tasks?: Record<
    string,
    Array<{
      id: string
      payload: JsonObject | null
      result: JsonObject | null
      status: string
    }>
  >
}

// ── Step Execution Context ────────────────────────────────────────
// Passed to StepExecutor.execute() so handlers can access engine services.
// The externalActions field is the ONLY sanctioned way to call external APIs.

import type { PoolClient } from 'pg'
import type { ExternalActionExecutor } from '../engine/ExternalActionExecutor.js'
import type { TaskManager } from '../engine/TaskManager.js'
import type { IntegrationRegistry } from '../integrations/IntegrationRegistry.js'

export interface StepExecutionContext {
  /** The only sanctioned way to call external APIs from a step. */
  externalActions: ExternalActionExecutor
  /** Typed integration wrappers (GitHub, Linear, Slack, etc.) */
  integrations?: IntegrationRegistry
  /** Task manager for fan-out/fan-in task execution */
  taskManager?: TaskManager
  /** Budget check callback: increments usage and returns exceeded reason or null */
  checkBudget?: (
    runId: string,
    field: string,
    amount?: number,
  ) => Promise<string | null>
  /**
   * Postgres transaction client — only present when the step is `transactional`.
   * All queries through `ctx.tx` participate in the same transaction that
   * records step completion. COMMIT = atomic; ROLLBACK on error = nothing happened.
   */
  tx?: PoolClient
}

// ── Step Definition ────────────────────────────────────────────────

export type StepWeight = 'light' | 'heavy' | 'ai' | 'sandbox'

export interface BackoffConfig {
  /** Backoff strategy. 'exponential' doubles delay each attempt; 'fixed' uses constant delay. */
  type: 'exponential' | 'fixed'
  /** Initial delay in ms before first retry (default: 1000). */
  delayMs?: number
  /** Maximum delay in ms (default: 60000). Only applies to 'exponential'. */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2). */
  multiplier?: number
}

export interface StepDefinition {
  name: string
  dependsOn?: string[]
  executorType: string
  executorConfig: Record<string, unknown>
  retries?: number
  timeoutMs?: number
  heartbeatTimeoutMs?: number
  scheduleToStartTimeoutMs?: number
  requiresHumanApproval?: boolean
  /** Max iterations for nextStep loops (default: 100) */
  maxIterations?: number
  /**
   * Step weight controls queue routing for worker specialization.
   * - 'light' (default): function steps, AI calls (~100MB)
   * - 'heavy': Docker/sandbox steps (~4GB)
   * Steps are routed to `workflow_step_light` or `workflow_step_heavy` queues.
   */
  stepWeight?: StepWeight
  /**
   * Labels a worker MUST advertise to be eligible to run this step.
   * AND-matched: a worker is only chosen if its `capabilities.labels`
   * is a superset of this array. Mirrors GitHub Actions `runs-on`.
   *
   * Use for coarse segmentation (e.g. `['sdlc']` so a step never lands
   * on a generic Cloud Run worker) or fine-grained capability matching
   * (e.g. `['has-claude', 'has-gh', 'linux']`). Empty / unset = any
   * worker is eligible.
   */
  requiresLabels?: string[]
  /**
   * Retry backoff configuration. When set, failed steps wait before retrying
   * instead of being re-queued immediately.
   *
   * - `type: 'exponential'` — delay doubles each attempt (with jitter)
   * - `type: 'fixed'` — constant delay between retries
   *
   * Default (unset): immediate retry (no delay).
   */
  backoff?: BackoffConfig
  /**
   * When true, step execution + result recording happen in a single PG
   * transaction. App writes via `ctx.tx` are atomic with step completion.
   */
  transactional?: boolean
  condition?: (ctx: StepContext) => boolean | Promise<boolean>
  mapInput?: (upstreamOutputs: Record<string, JsonObject>) => JsonObject
}

// ── Workflow Definition ────────────────────────────────────────────

export interface SignalHandler {
  handler: (ctx: StepContext, data: JsonObject) => Promise<void>
}

export interface QueryHandler {
  handler: (ctx: StepContext) => JsonObject | Promise<JsonObject>
}

/**
 * Durability guarantee for the `/start-async` ingest path.
 *
 * - 'buffered' (default): HTTP returns as soon as the trigger is in the
 *   in-memory IngestBuffer. Flush to Redis (addBulk) and PG (COPY FROM)
 *   happen asynchronously. Fastest — ~1-2ms responses, ~2k req/s/process —
 *   but if the HTTP process crashes inside the flush window (<= ~70ms),
 *   the request is lost.
 *
 * - 'committed': HTTP returns only after the workflow_runs row has been
 *   COPY-FROM'd and COMMIT'd to Postgres. Still batched (amortized COPY
 *   across concurrent committed requests via BatchedJobProcessor), so
 *   throughput stays high — but each caller waits one flush window + COPY
 *   time (~30-80ms typical). Use for critical flows where "accepted" must
 *   mean "durable on disk" (payments, financial ops, anything irreversible).
 */
export type WorkflowDurability = 'buffered' | 'committed'

export interface WorkflowDefinition {
  name: string
  version: string
  defaultRetries: number
  defaultTimeoutMs: number
  failFast: boolean
  steps: StepDefinition[]
  triggers?: WorkflowTrigger[]
  signals?: Record<string, SignalHandler>
  queries?: Record<string, QueryHandler>
  onComplete?: (ctx: StepContext) => Promise<void>
  onFail?: (ctx: StepContext, error: Error) => Promise<void>
  /**
   * Called when a step's rollback fails during saga compensation.
   * Use for alerting, escalation, or manual intervention queues.
   * Receives the step name, the original error that caused the workflow to fail,
   * and the rollback error.
   */
  onRollbackFailed?: (ctx: {
    stepName: string
    rollbackError: Error
    workflowRunId: string
    tenantId: string
  }) => Promise<void> | void
  /** Ingestion durability guarantee. Default: 'buffered'. */
  durability?: WorkflowDurability
  /** Declared input field names for runtime introspection (trigger forms). */
  inputFields?: readonly string[]
  /** Fields containing PII — redacted in API responses. */
  sensitiveFields?: readonly string[]
  /** DBOS-parity: optional input validation schema (Zod-compatible) */
  inputSchema?: { parse: (input: unknown) => unknown }
  /** Cron schedule for automatic recurring execution via dispatcher. */
  schedule?: {
    cron: string
    /** IANA timezone identifier (e.g., 'America/New_York'). Default: 'UTC'. */
    timezone?: IANATimezone
    /** Fire immediately on first sync/startup, then follow the cron pattern. Default: false. */
    runOnInit?: boolean
    input?: unknown
    environments?: string[]
    tenants?: string[]
  }
}

// ── Workflow Triggers ──────────────────────────────────────────────

export interface WorkflowTrigger {
  type: 'event' | 'manual'
  /** Event type to match (e.g. 'github.pr.opened') */
  eventType?: string
  /** Optional filter on event payload */
  filter?: (payload: JsonObject) => boolean
  /** Transform event payload into workflow input */
  mapTriggerInput?: (payload: JsonObject) => JsonObject
}

// ── Runtime Payloads ───────────────────────────────────────────────

export interface WorkflowTriggerInput {
  workflowName: string
  tenantId: string
  input: JsonObject
  idempotencyKey?: string
  priority?: number
  /** Trace ID for cross-workflow lineage. Auto-generated if not provided. */
  traceId?: string
  /** Parent workflow run ID (for child workflows) */
  parentRunId?: string
  /** Origin event ID that triggered this workflow */
  originEventId?: string
  /** Pre-assigned run ID (for queue-first ingestion — caller owns the ID). Auto-generated if not provided. */
  runId?: string
  /** DBOS-parity: delay workflow start by this many seconds */
  delaySeconds?: number
}

export interface StepPayload {
  [key: string]: JsonValue | undefined
  workflowRunId: string
  stepName: string
  tenantId: string
  input: JsonObject
  attempt: number
  executorType: string
  executorConfig: JsonObject
  lastHeartbeatData?: JsonObject
  heartbeatTimeoutMs?: number
  scheduleToStartTimeoutMs?: number
  /**
   * Labels the runner must advertise (AND-match). Propagated from the
   * step definition at dispatch time so the WorkerBroker can filter
   * agents without re-reading the definition from the engine.
   */
  requiresLabels?: string[]
  /** When true, execution + result recording happen in one PG transaction. */
  transactional?: boolean
}

export interface StepResult {
  output: JsonObject
  /** Redirect execution to a named step (runtime loop, not DAG cycle) */
  nextStep?: string
  waitForHuman?: {
    prompt: string
    schema?: JsonObject
  }
}

// ── Human-in-the-Loop ──────────────────────────────────────────────

export interface HumanInput {
  workflowRunId: string
  stepName: string
  tenantId: string
  data: JsonObject
  respondedBy?: string
}

// ── Interceptors ───────────────────────────────────────────────────

export interface StepInterceptor {
  beforeExecute?(payload: StepPayload): Promise<StepPayload>
  afterExecute?(payload: StepPayload, result: StepResult): Promise<StepResult>
  onError?(payload: StepPayload, error: Error): Promise<void>
}

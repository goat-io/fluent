// npx vitest run src/__tests__/state-machine.spec.ts
import type { JsonObject, JsonValue } from '@goatlab/tasks-core'

// ── Workflow Status ────────────────────────────────────────────────

export type WorkflowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type StepStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'WAITING_HUMAN'

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
}

// ── Step Definition ────────────────────────────────────────────────

export type StepWeight = 'light' | 'heavy' | 'ai' | 'sandbox'

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
  /** Ingestion durability guarantee. Default: 'buffered'. */
  durability?: WorkflowDurability
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

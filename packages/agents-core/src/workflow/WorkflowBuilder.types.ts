// npx vitest run src/__tests__/state-machine.spec.ts
import type { JsonObject } from '@goatlab/tasks-core'

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
}

// ── Step Execution Context ────────────────────────────────────────
// Passed to StepExecutor.execute() so handlers can access engine services.
// The externalActions field is the ONLY sanctioned way to call external APIs.

import type { ExternalActionExecutor } from '../engine/ExternalActionExecutor.js'
import type { IntegrationRegistry } from '../integrations/IntegrationRegistry.js'

export interface StepExecutionContext {
  /** The only sanctioned way to call external APIs from a step. */
  externalActions: ExternalActionExecutor
  /** Typed integration wrappers (GitHub, Linear, Slack, etc.) */
  integrations?: IntegrationRegistry
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
}

export interface StepPayload {
  workflowRunId: string
  stepName: string
  tenantId: string
  input: JsonObject
  attempt: number
  executorType: string
  executorConfig: Record<string, unknown>
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

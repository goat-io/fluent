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

// ── Step Definition ────────────────────────────────────────────────

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
  signals?: Record<string, SignalHandler>
  queries?: Record<string, QueryHandler>
  onComplete?: (ctx: StepContext) => Promise<void>
  onFail?: (ctx: StepContext, error: Error) => Promise<void>
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

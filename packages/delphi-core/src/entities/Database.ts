// npx vitest run src/__tests__/engine/lifecycle.spec.ts
//
// Kysely database schema — no decorators, no classes, no reflection.
// Works with Postgres AND SQLite.
//
import type { Generated, Insertable, Selectable, Updateable } from 'kysely'

// ── Workflow Runs ──────────────────────────────────────────────────

export interface WorkflowRunTable {
  id: string
  tenantId: string
  workflowName: string
  workflowVersion: string
  status: string
  definitionSnapshot: string | null // JSON: frozen workflow definition at start time
  triggerInput: string | null
  output: string | null
  error: string | null
  idempotencyKey: string | null
  /** Trace ID for cross-workflow lineage */
  traceId: string | null
  /** Parent workflow run ID (for child workflows) */
  parentRunId: string | null
  /** Origin event ID that triggered this workflow */
  originEventId: string | null
  /** Budget guardrails config (JSON) */
  budget: string | null
  /** Accumulated budget usage (JSON) */
  budgetUsed: string | null
  startedAt: Date | string | null
  completedAt: Date | string | null
  createdAt: Generated<Date | string>
  updatedAt: Generated<Date | string>
}

export type WorkflowRun = Selectable<WorkflowRunTable>
export type NewWorkflowRun = Insertable<WorkflowRunTable>
export type WorkflowRunUpdate = Updateable<WorkflowRunTable>

// ── Workflow Steps ─────────────────────────────────────────────────

export interface WorkflowStepTable {
  id: string
  workflowRunId: string
  tenantId: string
  stepName: string
  status: string
  executorType: string
  executorConfig: string | null
  dependsOn: string | null // JSON array of step names
  input: string | null
  output: string | null
  error: string | null
  attempt: number
  maxRetries: number
  startedAt: Date | string | null
  completedAt: Date | string | null
  scheduledAt: Date | string | null
  lastHeartbeatAt: Date | string | null
  lastHeartbeatData: string | null
  heartbeatTimeoutMs: number | null
  humanPrompt: string | null
  humanResponse: string | null
  humanRespondedBy: string | null
  humanRespondedAt: Date | string | null
  /** nextStep loop iteration tracking */
  iterationCount: number | null
  maxIterations: number | null
  /** Cost tracking: total tokens used by this step */
  tokensUsed: number | null
  /** Cost tracking: estimated cost in USD (e.g., 0.0023) */
  costUsd: string | null
  /** Cost tracking: model used (e.g., 'gpt-4o', 'claude-sonnet-4-20250514') */
  modelUsed: string | null
  /** Worker identity: which machine/process executed this step */
  executedBy: string | null
  createdAt: Generated<Date | string>
  updatedAt: Generated<Date | string>
}

export type WorkflowStep = Selectable<WorkflowStepTable>
export type NewWorkflowStep = Insertable<WorkflowStepTable>
export type WorkflowStepUpdate = Updateable<WorkflowStepTable>

// ── Workflow Step Logs ─────────────────────────────────────────────

export type StepLogEvent =
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'retried'
  | 'skipped'
  | 'human_requested'
  | 'human_responded'
  | 'heartbeat'
  | 'cancelled'

export interface WorkflowStepLogTable {
  id: string
  stepId: string
  tenantId: string
  event: string
  data: string | null
  createdAt: Generated<Date | string>
}

export type WorkflowStepLog = Selectable<WorkflowStepLogTable>
export type NewWorkflowStepLog = Insertable<WorkflowStepLogTable>

// ── Workflow Signals ───────────────────────────────────────────────

export interface WorkflowSignalTable {
  id: string
  workflowRunId: string
  tenantId: string
  signalName: string
  data: string
  processedAt: Date | string | null
  createdAt: Generated<Date | string>
}

export type WorkflowSignal = Selectable<WorkflowSignalTable>
export type NewWorkflowSignal = Insertable<WorkflowSignalTable>

// ── External Actions ───────────────────────────────────────────────
// The consistency layer for ALL side effects that touch the real world.
// Every external API call (create PR, create issue, send email, deploy)
// MUST go through this table. This guarantees exactly-once execution
// even across retries and worker crashes.

export type ExternalActionStatus =
  | 'pending'
  | 'completing'
  | 'completed'
  | 'failed'

export interface ExternalActionTable {
  id: string
  workflowRunId: string
  stepName: string
  attempt: number
  tenantId: string

  provider: string // 'github' | 'linear' | 'slack' | etc
  actionType: string // 'create_pr' | 'create_issue' | 'comment' | etc
  idempotencyKey: string // unique per action, e.g. '{runId}:{stepName}:{actionType}'

  status: string // 'pending' | 'completed' | 'failed'
  externalId: string | null // The ID returned by the external system (PR id, issue id)

  request: string | null // JSON: what we sent
  response: string | null // JSON: what we got back
  error: string | null // Error message if failed

  /** Trace ID for cross-workflow lineage */
  traceId: string | null

  createdAt: Generated<Date | string>
  completedAt: Date | string | null
}

export type ExternalAction = Selectable<ExternalActionTable>
export type NewExternalAction = Insertable<ExternalActionTable>
export type ExternalActionUpdate = Updateable<ExternalActionTable>

// ── Workflow Events ───────────────────────────────────────────────

export interface WorkflowEventTable {
  id: string
  tenantId: string
  eventType: string
  source: string
  payload: string | null
  idempotencyKey: string | null
  /** Entity key for ordering (e.g. 'github:pr:123') */
  entityKey: string | null
  /** Sequence number within entity — higher = newer */
  sequenceNumber: number | null
  /** Trace ID for cross-workflow lineage */
  traceId: string | null
  status: string // 'pending' | 'processed' | 'failed' | 'dead_letter' | 'skipped_stale'
  error: string | null
  processedAt: Date | string | null
  createdAt: Generated<Date | string>
}

export type WorkflowEvent = Selectable<WorkflowEventTable>
export type NewWorkflowEvent = Insertable<WorkflowEventTable>
export type WorkflowEventUpdate = Updateable<WorkflowEventTable>

// ── Workflow Event Subscriptions ──────────────────────────────────

export interface WorkflowEventSubscriptionTable {
  id: string
  tenantId: string
  eventType: string
  workflowName: string
  filterExpression: string | null
  active: boolean
  createdAt: Generated<Date | string>
}

export type WorkflowEventSubscription =
  Selectable<WorkflowEventSubscriptionTable>
export type NewWorkflowEventSubscription =
  Insertable<WorkflowEventSubscriptionTable>

// ── Worker Nodes ──────────────────────────────────────────────────

export interface WorkerNodeTable {
  id: string
  tenantId: string | null
  accountId: string | null
  name: string
  hostname: string | null
  capabilities: string | null
  secretHash: string | null
  status: string
  lastHeartbeatAt: Date | string | null
  registeredAt: Generated<Date | string>
  createdAt: Generated<Date | string>
}

export type WorkerNodeRow = Selectable<WorkerNodeTable>
export type NewWorkerNode = Insertable<WorkerNodeTable>
export type WorkerNodeUpdate = Updateable<WorkerNodeTable>

// ── Workflow Definitions ──────────────────────────────────────────

export interface WorkflowDefinitionTable {
  id: string
  tenantId: string
  name: string
  version: string
  definition: string
  createdBy: string | null
  createdAt: Generated<Date | string>
  updatedAt: Generated<Date | string>
}

export type WorkflowDefinitionRow = Selectable<WorkflowDefinitionTable>
export type NewWorkflowDefinition = Insertable<WorkflowDefinitionTable>
export type WorkflowDefinitionUpdate = Updateable<WorkflowDefinitionTable>

// ── Workflow Tasks ────────────────────────────────────────────────

export type WorkflowTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface WorkflowTaskTable {
  id: string
  workflowRunId: string
  stepName: string
  status: string
  payload: string | null
  result: string | null
  error: string | null
  attempt: number
  maxRetries: number
  priority: number | null
  createdAt: Generated<Date | string>
  updatedAt: Generated<Date | string>
}

export type WorkflowTask = Selectable<WorkflowTaskTable>
export type NewWorkflowTask = Insertable<WorkflowTaskTable>
export type WorkflowTaskUpdate = Updateable<WorkflowTaskTable>

// ── Workflow Schedules ────────────────────────────────────────────

export interface WorkflowScheduleTable {
  id: string
  tenantId: string
  workflowName: string
  cronExpression: string
  nextRunAt: Date | string
  lastRunAt: Date | string | null
  active: boolean
  createdAt: Generated<Date | string>
}

export type WorkflowSchedule = Selectable<WorkflowScheduleTable>
export type NewWorkflowSchedule = Insertable<WorkflowScheduleTable>
export type WorkflowScheduleUpdate = Updateable<WorkflowScheduleTable>

// ── Database Schema ────────────────────────────────────────────────

// ── Agent Tokens ──────────────────────────────────────────────────

export interface AgentTokenTable {
  id: string
  tenantId: string
  token: string
  used: boolean
  usedBy: string | null
  expiresAt: Date | string | null
  createdAt: Generated<Date | string>
}

export type AgentToken = Selectable<AgentTokenTable>
export type NewAgentToken = Insertable<AgentTokenTable>

// ── Database Schema ────────────────────────────────────────────────

export interface Database {
  workflow_runs: WorkflowRunTable
  workflow_steps: WorkflowStepTable
  workflow_step_logs: WorkflowStepLogTable
  workflow_signals: WorkflowSignalTable
  external_actions: ExternalActionTable
  workflow_events: WorkflowEventTable
  workflow_event_subscriptions: WorkflowEventSubscriptionTable
  worker_nodes: WorkerNodeTable
  workflow_definitions: WorkflowDefinitionTable
  workflow_tasks: WorkflowTaskTable
  workflow_schedules: WorkflowScheduleTable
  agent_tokens: AgentTokenTable
}

// ── JSON Helpers ───────────────────────────────────────────────────

export function toJson(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return JSON.stringify(value)
}

export function fromJson<T = Record<string, unknown>>(
  value: string | null | undefined,
): T | null {
  if (value === null || value === undefined) {
    return null
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

// ── Table Creation SQL ─────────────────────────────────────────────

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  "workflowName" VARCHAR(255) NOT NULL,
  "workflowVersion" VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  "definitionSnapshot" TEXT,
  "triggerInput" TEXT,
  output TEXT,
  error TEXT,
  "idempotencyKey" VARCHAR(255),
  "traceId" VARCHAR(36),
  "parentRunId" VARCHAR(36),
  "originEventId" VARCHAR(36),
  budget TEXT,
  "budgetUsed" TEXT,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Tenant-scoped idempotency: two tenants can legitimately use the
  -- same idempotencyKey without colliding. Within a tenant, the
  -- constraint + pre-SELECT dedupe in startBatchCopy guarantee at
  -- most one run per key.
  UNIQUE("tenantId", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id VARCHAR(36) PRIMARY KEY,
  "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  "tenantId" VARCHAR(255) NOT NULL,
  "stepName" VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  "executorType" VARCHAR(100) NOT NULL,
  "executorConfig" TEXT,
  "dependsOn" TEXT,
  input TEXT,
  output TEXT,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "scheduledAt" TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP,
  "lastHeartbeatData" TEXT,
  "heartbeatTimeoutMs" INTEGER,
  "humanPrompt" TEXT,
  "humanResponse" TEXT,
  "humanRespondedBy" VARCHAR(255),
  "humanRespondedAt" TIMESTAMP,
  "iterationCount" INTEGER DEFAULT 0,
  "maxIterations" INTEGER,
  "tokensUsed" INTEGER,
  "costUsd" VARCHAR(20),
  "modelUsed" VARCHAR(100),
  "executedBy" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("workflowRunId", "stepName")
);

CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id VARCHAR(36) PRIMARY KEY,
  "stepId" VARCHAR(36) NOT NULL,
  "tenantId" VARCHAR(255) NOT NULL,
  event VARCHAR(30) NOT NULL,
  data TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_signals (
  id VARCHAR(36) PRIMARY KEY,
  "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  "tenantId" VARCHAR(255) NOT NULL,
  "signalName" VARCHAR(255) NOT NULL,
  data TEXT NOT NULL,
  "processedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_actions (
  id VARCHAR(36) PRIMARY KEY,
  "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  "stepName" VARCHAR(255) NOT NULL,
  attempt INTEGER NOT NULL,
  "tenantId" VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  "actionType" VARCHAR(100) NOT NULL,
  "idempotencyKey" VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  "externalId" VARCHAR(500),
  request TEXT,
  response TEXT,
  error TEXT,
  "traceId" VARCHAR(36),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  UNIQUE("tenantId", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS idx_runs_tenant_status ON workflow_runs("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_steps_run_step ON workflow_steps("workflowRunId", "stepName");
CREATE INDEX IF NOT EXISTS idx_steps_tenant_status ON workflow_steps("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_logs_tenant_step ON workflow_step_logs("tenantId", "stepId");
CREATE INDEX IF NOT EXISTS idx_signals_run_signal ON workflow_signals("workflowRunId", "signalName", "processedAt");
CREATE INDEX IF NOT EXISTS idx_external_actions_key ON external_actions("idempotencyKey");
CREATE INDEX IF NOT EXISTS idx_external_actions_step ON external_actions("workflowRunId", "stepName", attempt);

CREATE TABLE IF NOT EXISTS workflow_events (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  "eventType" VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  payload TEXT,
  "idempotencyKey" VARCHAR(500),
  "entityKey" VARCHAR(500),
  "sequenceNumber" INTEGER,
  "traceId" VARCHAR(36),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error TEXT,
  "processedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("tenantId", "idempotencyKey")
);
CREATE INDEX IF NOT EXISTS idx_events_tenant_type ON workflow_events("tenantId", "eventType", status);
CREATE INDEX IF NOT EXISTS idx_events_entity ON workflow_events("entityKey", "sequenceNumber");

CREATE TABLE IF NOT EXISTS workflow_event_subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  "eventType" VARCHAR(255) NOT NULL,
  "workflowName" VARCHAR(255) NOT NULL,
  "filterExpression" TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_event_subs_tenant_type ON workflow_event_subscriptions("tenantId", "eventType", active);

CREATE TABLE IF NOT EXISTS worker_nodes (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255),
  "accountId" VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  capabilities TEXT,
  "secretHash" VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  "lastHeartbeatAt" TIMESTAMP,
  "registeredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workers_tenant_status ON worker_nodes("tenantId", status);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  definition TEXT NOT NULL,
  "createdBy" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_definitions_tenant_name ON workflow_definitions("tenantId", name);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id VARCHAR(36) PRIMARY KEY,
  "workflowRunId" VARCHAR(36) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  "stepName" VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload TEXT,
  result TEXT,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  priority INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_run_step ON workflow_tasks("workflowRunId", "stepName", status);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON workflow_tasks(status, priority DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  "workflowName" VARCHAR(255) NOT NULL,
  "cronExpression" VARCHAR(100) NOT NULL,
  "nextRunAt" TIMESTAMP NOT NULL,
  "lastRunAt" TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_next ON workflow_schedules(active, "nextRunAt");

CREATE TABLE IF NOT EXISTS agent_tokens (
  id VARCHAR(36) PRIMARY KEY,
  "tenantId" VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  "usedBy" VARCHAR(36),
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_token ON agent_tokens(token);
`

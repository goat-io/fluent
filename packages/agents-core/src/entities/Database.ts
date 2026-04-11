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
  triggerInput: string | null
  output: string | null
  error: string | null
  idempotencyKey: string | null
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
  dependsOn: string | null        // JSON array of step names
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

// ── Database Schema ────────────────────────────────────────────────

export interface Database {
  workflow_runs: WorkflowRunTable
  workflow_steps: WorkflowStepTable
  workflow_step_logs: WorkflowStepLogTable
  workflow_signals: WorkflowSignalTable
}

// ── JSON Helpers ───────────────────────────────────────────────────

export function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

export function fromJson<T = Record<string, unknown>>(value: string | null | undefined): T | null {
  if (value === null || value === undefined) return null
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
  "triggerInput" TEXT,
  output TEXT,
  error TEXT,
  "idempotencyKey" VARCHAR(255),
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_runs_tenant_status ON workflow_runs("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_steps_run_step ON workflow_steps("workflowRunId", "stepName");
CREATE INDEX IF NOT EXISTS idx_steps_tenant_status ON workflow_steps("tenantId", status);
CREATE INDEX IF NOT EXISTS idx_logs_tenant_step ON workflow_step_logs("tenantId", "stepId");
CREATE INDEX IF NOT EXISTS idx_signals_run_signal ON workflow_signals("workflowRunId", "signalName", "processedAt");
`

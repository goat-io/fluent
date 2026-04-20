// Types matching the WorkflowHandlers API responses

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

export interface WorkflowRunSummary {
  id: string
  workflowName: string
  workflowVersion: string
  status: WorkflowStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  error?: string
  stepCount: number
  completedStepCount: number
}

export interface StepDetail {
  id: string
  stepName: string
  status: StepStatus
  executorType: string
  attempt: number
  maxRetries: number
  dependsOn?: string[]
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt: string | null
  completedAt: string | null
  humanPrompt?: Record<string, unknown>
  humanResponse?: Record<string, unknown>
  humanRespondedBy?: string
  executedBy?: string | null
}

/**
 * A single row in `workflow_tasks` — the fan-out primitive delphi uses
 * to record multiple sub-units of work under one step. For agreement
 * cycles, each row is one LLM call (proposer, reviewer, arbiter, etc.)
 * and the payload/result carry domain-specific data (turn, role,
 * rubric scores, tokens).
 */
export interface WorkflowTask {
  id: string
  workflowRunId: string
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  attempt: number
  priority: number | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowRunDetail {
  id: string
  workflowName: string
  workflowVersion: string
  status: WorkflowStatus
  triggerInput?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  steps: StepDetail[]
  traceId?: string
  parentRunId?: string
  budget?: WorkflowBudget | null
  budgetUsed?: BudgetUsed | null
}

export interface WorkflowBudget {
  maxTokens?: number
  maxCostUsd?: number
  maxSteps?: number
  maxTaskExecutions?: number
}

export interface BudgetUsed {
  tokens: number
  costUsd: number
  steps: number
  taskExecutions: number
}

export interface StepLog {
  id: string
  event: string
  data?: Record<string, unknown>
  createdAt: string
}

export interface WorkflowFilters {
  status?: WorkflowStatus[]
  workflowName?: string
  limit?: number
  offset?: number
}

export interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

// ── Metrics Types ─────────────────────────────────────────────────

export interface StepLatencyMetrics {
  stepName: string
  executorType: string
  status: string
  queueLatencyMs: number | null
  scheduleToStartMs: number | null
  executionMs: number | null
  totalMs: number | null
  attempt: number
  tokensUsed: number | null
  costUsd: number | null
  modelUsed: string | null
}

export interface ExternalActionMetrics {
  provider: string
  actionType: string
  status: string
  latencyMs: number | null
  cached: boolean
}

export interface WorkflowRunMetrics {
  workflowRunId: string
  workflowName: string
  status: string
  totalMs: number | null
  stepCount: number
  completedStepCount: number
  failedStepCount: number
  totalTokens: number
  totalCostUsd: number
  steps: StepLatencyMetrics[]
  externalActions: ExternalActionMetrics[]
}

export interface AggregateMetrics {
  avgExecutionMsByExecutor: Record<string, number>
  avgActionLatencyByProvider: Record<string, number>
  actionCountByProvider: Record<string, number>
  stepExecutionPercentiles: { p50: number; p95: number; p99: number } | null
}

// ── Schedule Types ───────────────────────────────────────────────

export interface WorkflowSchedule {
  id: string
  tenantId: string
  workflowName: string
  cronExpression: string
  nextRunAt: string
  lastRunAt: string | null
  active: boolean
  createdAt: string
}

// ── Trace Types ─────────────────────────────────────────────────

export interface TraceLineage {
  runs: WorkflowRunSummary[]
  events: Array<{
    id: string
    eventType: string
    source: string
    payload?: Record<string, unknown>
    traceId?: string
    createdAt: string
  }>
  actions: Array<{
    id: string
    provider: string
    actionType: string
    status: string
    traceId?: string
    createdAt: string
  }>
}

// ── Worker Types ─────────────────────────────────────────────────

export interface WorkerNodeInfo {
  id: string
  name: string
  hostname: string | null
  capabilities: {
    cpuCount?: number
    memoryMB?: number
    dockerAvailable?: boolean
    gpuAvailable?: boolean
    queues?: string[]
  } | null
  status: 'active' | 'draining' | 'offline'
  lastHeartbeatAt: string | null
  registeredAt: string
}

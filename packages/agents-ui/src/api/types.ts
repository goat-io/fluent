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

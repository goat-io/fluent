// npx vitest run src/__tests__/engine/metrics.spec.ts
//
// Observability: step latency, external action latency, cost-per-step metrics.
//
import type { DbClient } from '../db/DbClient.js'
import type {
  ExternalAction,
  WorkflowRun,
  WorkflowStep,
} from '../entities/Database.js'

// ── Metric Types ──────────────────────────────────────────────────

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

// ── Collector ─────────────────────────────────────────────────────

export class WorkflowMetricsCollector {
  constructor(private db: DbClient) {}

  async getRunMetrics(
    workflowRunId: string,
  ): Promise<WorkflowRunMetrics | null> {
    const { rows: runRows } = await this.db.query<WorkflowRun>(
      `SELECT * FROM workflow_runs WHERE id = $1`,
      [workflowRunId],
    )
    const run = runRows[0]
    if (!run) {
      return null
    }

    const { rows: steps } = await this.db.query<WorkflowStep>(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1`,
      [workflowRunId],
    )

    const { rows: actions } = await this.db.query<ExternalAction>(
      `SELECT * FROM external_actions WHERE "workflowRunId" = $1`,
      [workflowRunId],
    )

    const stepMetrics: StepLatencyMetrics[] = steps.map(s => {
      const created = toMs(s.createdAt)
      const scheduled = toMs(s.scheduledAt)
      const started = toMs(s.startedAt)
      const completed = toMs(s.completedAt)

      return {
        stepName: s.stepName,
        executorType: s.executorType,
        status: s.status,
        queueLatencyMs: diffMs(created, scheduled),
        scheduleToStartMs: diffMs(scheduled, started),
        executionMs: diffMs(started, completed),
        totalMs: diffMs(created, completed),
        attempt: s.attempt,
        tokensUsed: s.tokensUsed ?? null,
        costUsd: s.costUsd ? Number.parseFloat(s.costUsd) : null,
        modelUsed: s.modelUsed ?? null,
      }
    })

    const actionMetrics: ExternalActionMetrics[] = actions.map(a => ({
      provider: a.provider,
      actionType: a.actionType,
      status: a.status,
      latencyMs: diffMs(toMs(a.createdAt), toMs(a.completedAt)),
      cached: false,
    }))

    const runStart = toMs(run.startedAt)
    const runEnd = toMs(run.completedAt)

    const totalTokens = stepMetrics.reduce(
      (sum, s) => sum + (s.tokensUsed ?? 0),
      0,
    )
    const totalCostUsd = stepMetrics.reduce(
      (sum, s) => sum + (s.costUsd ?? 0),
      0,
    )

    return {
      workflowRunId,
      workflowName: run.workflowName,
      status: run.status,
      totalMs: diffMs(runStart, runEnd),
      stepCount: steps.length,
      completedStepCount: steps.filter(s => s.status === 'COMPLETED').length,
      failedStepCount: steps.filter(s => s.status === 'FAILED').length,
      totalTokens,
      totalCostUsd,
      steps: stepMetrics,
      externalActions: actionMetrics,
    }
  }

  async getAggregateMetrics(
    tenantId: string,
    opts?: { since?: Date; workflowName?: string },
  ): Promise<AggregateMetrics> {
    let stepsQuery = `SELECT * FROM workflow_steps WHERE "tenantId" = $1 AND status IN ('COMPLETED', 'FAILED')`
    const stepsParams: any[] = [tenantId]
    let paramIdx = 2

    if (opts?.since) {
      stepsQuery += ` AND "completedAt" >= $${paramIdx}`
      stepsParams.push(opts.since)
      paramIdx++
    }

    const { rows: steps } = await this.db.query<WorkflowStep>(
      stepsQuery,
      stepsParams,
    )

    let actionsQuery = `SELECT * FROM external_actions WHERE "tenantId" = $1 AND status = 'completed'`
    const actionsParams: any[] = [tenantId]
    let actionsParamIdx = 2

    if (opts?.since) {
      actionsQuery += ` AND "completedAt" >= $${actionsParamIdx}`
      actionsParams.push(opts.since)
      actionsParamIdx++
    }

    const { rows: actions } = await this.db.query<ExternalAction>(
      actionsQuery,
      actionsParams,
    )

    const execByType: Record<string, number[]> = {}
    const allExecTimes: number[] = []

    for (const s of steps) {
      const started = toMs(s.startedAt)
      const completed = toMs(s.completedAt)
      const execMs = diffMs(started, completed)
      if (execMs !== null) {
        if (!execByType[s.executorType]) {
          execByType[s.executorType] = []
        }
        execByType[s.executorType].push(execMs)
        allExecTimes.push(execMs)
      }
    }

    const avgExecutionMsByExecutor: Record<string, number> = {}
    for (const [type, times] of Object.entries(execByType)) {
      avgExecutionMsByExecutor[type] = Math.round(
        times.reduce((a, b) => a + b, 0) / times.length,
      )
    }

    const latencyByProvider: Record<string, number[]> = {}
    const countByProvider: Record<string, number> = {}

    for (const a of actions) {
      const latMs = diffMs(toMs(a.createdAt), toMs(a.completedAt))
      if (!latencyByProvider[a.provider]) {
        latencyByProvider[a.provider] = []
      }
      if (latMs !== null) {
        latencyByProvider[a.provider].push(latMs)
      }
      countByProvider[a.provider] = (countByProvider[a.provider] ?? 0) + 1
    }

    const avgActionLatencyByProvider: Record<string, number> = {}
    for (const [provider, times] of Object.entries(latencyByProvider)) {
      avgActionLatencyByProvider[provider] = Math.round(
        times.reduce((a, b) => a + b, 0) / times.length,
      )
    }

    let stepExecutionPercentiles: {
      p50: number
      p95: number
      p99: number
    } | null = null
    if (allExecTimes.length > 0) {
      allExecTimes.sort((a, b) => a - b)
      stepExecutionPercentiles = {
        p50: percentile(allExecTimes, 0.5),
        p95: percentile(allExecTimes, 0.95),
        p99: percentile(allExecTimes, 0.99),
      }
    }

    return {
      avgExecutionMsByExecutor,
      avgActionLatencyByProvider,
      actionCountByProvider: countByProvider,
      stepExecutionPercentiles,
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function toMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  return new Date(value).getTime()
}

function diffMs(start: number | null, end: number | null): number | null {
  if (start === null || end === null) {
    return null
  }
  return end - start
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

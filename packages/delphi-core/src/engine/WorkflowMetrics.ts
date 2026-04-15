// npx vitest run src/__tests__/engine/metrics.spec.ts
//
// Observability: step latency, external action latency, cost-per-step metrics.
//
import type { Kysely } from 'kysely'
import type { Database } from '../entities/Database.js'

// ── Metric Types ──────────────────────────────────────────────────

export interface StepLatencyMetrics {
  stepName: string
  executorType: string
  status: string
  /** ms from step creation to queued */
  queueLatencyMs: number | null
  /** ms from queued to running (schedule-to-start) */
  scheduleToStartMs: number | null
  /** ms from running to completed/failed (execution time) */
  executionMs: number | null
  /** ms from creation to completion (total) */
  totalMs: number | null
  attempt: number
  /** Token usage (if tracked by StepCostTracker) */
  tokensUsed: number | null
  /** Cost in USD (if tracked) */
  costUsd: number | null
  /** Model used (if tracked) */
  modelUsed: string | null
}

export interface ExternalActionMetrics {
  provider: string
  actionType: string
  status: string
  /** ms from creation to completion */
  latencyMs: number | null
  cached: boolean
}

export interface WorkflowRunMetrics {
  workflowRunId: string
  workflowName: string
  status: string
  /** ms from start to completion */
  totalMs: number | null
  stepCount: number
  completedStepCount: number
  failedStepCount: number
  /** Total tokens used across all steps */
  totalTokens: number
  /** Total cost in USD across all steps */
  totalCostUsd: number
  steps: StepLatencyMetrics[]
  externalActions: ExternalActionMetrics[]
}

export interface AggregateMetrics {
  /** Average step execution time per executor type */
  avgExecutionMsByExecutor: Record<string, number>
  /** Average external action latency per provider */
  avgActionLatencyByProvider: Record<string, number>
  /** Total actions per provider */
  actionCountByProvider: Record<string, number>
  /** p50/p95/p99 step execution times */
  stepExecutionPercentiles: { p50: number; p95: number; p99: number } | null
}

// ── Collector ─────────────────────────────────────────────────────

export class WorkflowMetricsCollector {
  constructor(private db: Kysely<Database>) {}

  /**
   * Get detailed metrics for a single workflow run.
   */
  async getRunMetrics(workflowRunId: string): Promise<WorkflowRunMetrics | null> {
    const run = await this.db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('id', '=', workflowRunId)
      .executeTakeFirst()

    if (!run) return null

    const steps = await this.db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', workflowRunId)
      .execute()

    const actions = await this.db
      .selectFrom('external_actions')
      .selectAll()
      .where('workflowRunId', '=', workflowRunId)
      .execute()

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
        costUsd: s.costUsd ? parseFloat(s.costUsd) : null,
        modelUsed: s.modelUsed ?? null,
      }
    })

    const actionMetrics: ExternalActionMetrics[] = actions.map(a => ({
      provider: a.provider,
      actionType: a.actionType,
      status: a.status,
      latencyMs: diffMs(toMs(a.createdAt), toMs(a.completedAt)),
      cached: false, // cached responses don't create DB rows
    }))

    const runStart = toMs(run.startedAt)
    const runEnd = toMs(run.completedAt)

    const totalTokens = stepMetrics.reduce((sum, s) => sum + (s.tokensUsed ?? 0), 0)
    const totalCostUsd = stepMetrics.reduce((sum, s) => sum + (s.costUsd ?? 0), 0)

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

  /**
   * Get aggregate metrics across multiple workflow runs.
   */
  async getAggregateMetrics(
    tenantId: string,
    opts?: { since?: Date; workflowName?: string },
  ): Promise<AggregateMetrics> {
    let stepsQuery = this.db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .where('status', 'in', ['COMPLETED', 'FAILED'])

    if (opts?.since) {
      stepsQuery = stepsQuery.where('completedAt', '>=', opts.since)
    }

    const steps = await stepsQuery.execute()

    let actionsQuery = this.db
      .selectFrom('external_actions')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .where('status', '=', 'completed')

    if (opts?.since) {
      actionsQuery = actionsQuery.where('completedAt', '>=', opts.since)
    }

    const actions = await actionsQuery.execute()

    // Aggregate step execution times by executor type
    const execByType: Record<string, number[]> = {}
    const allExecTimes: number[] = []

    for (const s of steps) {
      const started = toMs(s.startedAt)
      const completed = toMs(s.completedAt)
      const execMs = diffMs(started, completed)
      if (execMs !== null) {
        if (!execByType[s.executorType]) execByType[s.executorType] = []
        execByType[s.executorType].push(execMs)
        allExecTimes.push(execMs)
      }
    }

    const avgExecutionMsByExecutor: Record<string, number> = {}
    for (const [type, times] of Object.entries(execByType)) {
      avgExecutionMsByExecutor[type] = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    }

    // Aggregate action latency by provider
    const latencyByProvider: Record<string, number[]> = {}
    const countByProvider: Record<string, number> = {}

    for (const a of actions) {
      const latMs = diffMs(toMs(a.createdAt), toMs(a.completedAt))
      if (!latencyByProvider[a.provider]) latencyByProvider[a.provider] = []
      if (latMs !== null) latencyByProvider[a.provider].push(latMs)
      countByProvider[a.provider] = (countByProvider[a.provider] ?? 0) + 1
    }

    const avgActionLatencyByProvider: Record<string, number> = {}
    for (const [provider, times] of Object.entries(latencyByProvider)) {
      avgActionLatencyByProvider[provider] = Math.round(
        times.reduce((a, b) => a + b, 0) / times.length,
      )
    }

    // Percentiles
    let stepExecutionPercentiles: { p50: number; p95: number; p99: number } | null = null
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
  if (value === null || value === undefined) return null
  return new Date(value).getTime()
}

function diffMs(start: number | null, end: number | null): number | null {
  if (start === null || end === null) return null
  return end - start
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

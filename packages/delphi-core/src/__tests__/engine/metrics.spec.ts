// npx vitest run src/__tests__/engine/metrics.spec.ts
//
// Tests for Issue #4: Observability — step/action latency + cost metrics
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowMetricsCollector } from '../../engine/WorkflowMetrics.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('WorkflowMetricsCollector', () => {
  let db: TestDb
  let metrics: WorkflowMetricsCollector

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    metrics = new WorkflowMetricsCollector(db)
  })

  // Helper to insert a workflow run with steps and timing
  async function insertRun(opts: {
    runId: string
    name?: string
    status?: string
    startedAt?: Date
    completedAt?: Date
    steps?: Array<{
      stepName: string
      status?: string
      executorType?: string
      createdAt?: Date
      scheduledAt?: Date
      startedAt?: Date
      completedAt?: Date
      attempt?: number
    }>
  }) {
    const now = new Date()
    await db
      .insertInto('workflow_runs')
      .values({
        id: opts.runId,
        tenantId: 'test',
        workflowName: opts.name ?? 'test_wf',
        workflowVersion: '1.0.0',
        status: opts.status ?? 'COMPLETED',
        startedAt: opts.startedAt ?? now,
        completedAt: opts.completedAt,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    if (opts.steps) {
      for (const s of opts.steps) {
        await db
          .insertInto('workflow_steps')
          .values({
            id: `step-${opts.runId}-${s.stepName}`,
            workflowRunId: opts.runId,
            tenantId: 'test',
            stepName: s.stepName,
            status: s.status ?? 'COMPLETED',
            executorType: s.executorType ?? 'function',
            attempt: s.attempt ?? 1,
            maxRetries: 3,
            createdAt: s.createdAt ?? now,
            scheduledAt: s.scheduledAt,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            updatedAt: now,
          })
          .execute()
      }
    }
  }

  describe('getRunMetrics', () => {
    it('returns null for non-existent run', async () => {
      const result = await metrics.getRunMetrics('nonexistent')
      expect(result).toBeNull()
    })

    it('computes step latencies correctly', async () => {
      const t0 = new Date('2025-01-01T00:00:00Z')
      const t1 = new Date('2025-01-01T00:00:00.100Z') // +100ms queued
      const t2 = new Date('2025-01-01T00:00:00.350Z') // +250ms started
      const t3 = new Date('2025-01-01T00:00:01.350Z') // +1000ms completed

      await insertRun({
        runId: 'run-1',
        startedAt: t0,
        completedAt: t3,
        steps: [
          {
            stepName: 'compute',
            executorType: 'function',
            createdAt: t0,
            scheduledAt: t1,
            startedAt: t2,
            completedAt: t3,
          },
        ],
      })

      const result = await metrics.getRunMetrics('run-1')
      expect(result).toBeDefined()
      expect(result!.totalMs).toBe(1350)
      expect(result!.stepCount).toBe(1)
      expect(result!.completedStepCount).toBe(1)

      const step = result!.steps[0]
      expect(step.stepName).toBe('compute')
      expect(step.queueLatencyMs).toBe(100)
      expect(step.scheduleToStartMs).toBe(250)
      expect(step.executionMs).toBe(1000)
      expect(step.totalMs).toBe(1350)
    })

    it('handles multiple steps with different timing', async () => {
      const base = new Date('2025-01-01T00:00:00Z')
      const ms = (n: number) => new Date(base.getTime() + n)

      await insertRun({
        runId: 'run-2',
        startedAt: base,
        completedAt: ms(5000),
        steps: [
          {
            stepName: 'fast',
            executorType: 'function',
            createdAt: base,
            scheduledAt: ms(10),
            startedAt: ms(20),
            completedAt: ms(50),
          },
          {
            stepName: 'slow',
            executorType: 'sandbox',
            createdAt: ms(50),
            scheduledAt: ms(100),
            startedAt: ms(500),
            completedAt: ms(5000),
          },
        ],
      })

      const result = await metrics.getRunMetrics('run-2')
      expect(result!.steps).toHaveLength(2)

      const fast = result!.steps.find(s => s.stepName === 'fast')!
      expect(fast.executionMs).toBe(30)

      const slow = result!.steps.find(s => s.stepName === 'slow')!
      expect(slow.executionMs).toBe(4500)
      expect(slow.scheduleToStartMs).toBe(400)
    })

    it('includes external action metrics', async () => {
      const base = new Date('2025-01-01T00:00:00Z')
      const ms = (n: number) => new Date(base.getTime() + n)

      await insertRun({
        runId: 'run-3',
        startedAt: base,
        completedAt: ms(2000),
        steps: [
          {
            stepName: 'create_tasks',
            createdAt: base,
            startedAt: ms(100),
            completedAt: ms(2000),
          },
        ],
      })

      // Insert external action
      await db
        .insertInto('external_actions')
        .values({
          id: 'ea-1',
          workflowRunId: 'run-3',
          stepName: 'create_tasks',
          attempt: 1,
          tenantId: 'test',
          provider: 'linear',
          actionType: 'create_issue',
          idempotencyKey: 'run-3:create_tasks:create_issue',
          status: 'completed',
          createdAt: ms(200),
          completedAt: ms(800),
        })
        .execute()

      const result = await metrics.getRunMetrics('run-3')
      expect(result!.externalActions).toHaveLength(1)
      expect(result!.externalActions[0].provider).toBe('linear')
      expect(result!.externalActions[0].latencyMs).toBe(600)
    })
  })

  describe('getAggregateMetrics', () => {
    it('computes average execution times by executor type', async () => {
      const base = new Date('2025-01-01T00:00:00Z')
      const ms = (n: number) => new Date(base.getTime() + n)

      // Two runs with different step types
      await insertRun({
        runId: 'agg-1',
        steps: [
          {
            stepName: 'a',
            executorType: 'function',
            startedAt: base,
            completedAt: ms(100),
          },
          {
            stepName: 'b',
            executorType: 'function',
            startedAt: base,
            completedAt: ms(200),
          },
          {
            stepName: 'c',
            executorType: 'sandbox',
            startedAt: base,
            completedAt: ms(5000),
          },
        ],
      })

      const result = await metrics.getAggregateMetrics('test')
      expect(result.avgExecutionMsByExecutor.function).toBe(150) // (100+200)/2
      expect(result.avgExecutionMsByExecutor.sandbox).toBe(5000)
    })

    it('computes percentiles', async () => {
      const base = new Date('2025-01-01T00:00:00Z')
      const ms = (n: number) => new Date(base.getTime() + n)

      await insertRun({
        runId: 'perc-1',
        steps: Array.from({ length: 100 }, (_, i) => ({
          stepName: `step-${i}`,
          executorType: 'function',
          startedAt: base,
          completedAt: ms((i + 1) * 10), // 10ms, 20ms, ..., 1000ms
        })),
      })

      const result = await metrics.getAggregateMetrics('test')
      expect(result.stepExecutionPercentiles).toBeDefined()
      expect(result.stepExecutionPercentiles!.p50).toBe(500)
      expect(result.stepExecutionPercentiles!.p95).toBe(950)
      expect(result.stepExecutionPercentiles!.p99).toBe(990)
    })

    it('aggregates external action latency by provider', async () => {
      const base = new Date('2025-01-01T00:00:00Z')
      const ms = (n: number) => new Date(base.getTime() + n)

      await insertRun({ runId: 'prov-1', steps: [{ stepName: 'a' }] })

      // Multiple actions for different providers
      await db
        .insertInto('external_actions')
        .values([
          {
            id: 'pa-1',
            workflowRunId: 'prov-1',
            stepName: 'a',
            attempt: 1,
            tenantId: 'test',
            provider: 'github',
            actionType: 'create_pr',
            idempotencyKey: 'k1',
            status: 'completed',
            createdAt: base,
            completedAt: ms(200),
          },
          {
            id: 'pa-2',
            workflowRunId: 'prov-1',
            stepName: 'a',
            attempt: 1,
            tenantId: 'test',
            provider: 'github',
            actionType: 'add_review',
            idempotencyKey: 'k2',
            status: 'completed',
            createdAt: base,
            completedAt: ms(400),
          },
          {
            id: 'pa-3',
            workflowRunId: 'prov-1',
            stepName: 'a',
            attempt: 1,
            tenantId: 'test',
            provider: 'linear',
            actionType: 'create_issue',
            idempotencyKey: 'k3',
            status: 'completed',
            createdAt: base,
            completedAt: ms(100),
          },
        ])
        .execute()

      const result = await metrics.getAggregateMetrics('test')
      expect(result.avgActionLatencyByProvider.github).toBe(300) // (200+400)/2
      expect(result.avgActionLatencyByProvider.linear).toBe(100)
      expect(result.actionCountByProvider.github).toBe(2)
      expect(result.actionCountByProvider.linear).toBe(1)
    })

    it('filters by since date', async () => {
      const old = new Date('2024-01-01T00:00:00Z')
      const recent = new Date('2025-06-01T00:00:00Z')
      const ms = (base: Date, n: number) => new Date(base.getTime() + n)

      await insertRun({
        runId: 'old-1',
        steps: [{ stepName: 'a', startedAt: old, completedAt: ms(old, 100) }],
      })
      await insertRun({
        runId: 'new-1',
        steps: [
          { stepName: 'a', startedAt: recent, completedAt: ms(recent, 500) },
        ],
      })

      const result = await metrics.getAggregateMetrics('test', {
        since: new Date('2025-01-01'),
      })
      expect(result.avgExecutionMsByExecutor.function).toBe(500) // Only recent
    })
  })
})

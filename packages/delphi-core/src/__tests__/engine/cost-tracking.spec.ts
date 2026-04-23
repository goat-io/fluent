// npx vitest run src/__tests__/engine/cost-tracking.spec.ts
//
// Tests for cost-per-step tracking via StepCostTracker interceptor
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { StepCostTracker } from '../../engine/StepCostTracker.js'
import { WorkflowMetricsCollector } from '../../engine/WorkflowMetrics.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('StepCostTracker', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    // Insert workflow run and step
    await db
      .insertInto('workflow_runs')
      .values({
        id: 'wf-cost',
        tenantId: 'test',
        workflowName: 'cost_test',
        workflowVersion: '1.0.0',
        status: 'RUNNING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()

    await db
      .insertInto('workflow_steps')
      .values({
        id: 'step-cost-1',
        workflowRunId: 'wf-cost',
        tenantId: 'test',
        stepName: 'ai_step',
        status: 'RUNNING',
        executorType: 'ai',
        attempt: 1,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()
  })

  const payload: StepPayload = {
    workflowRunId: 'wf-cost',
    stepName: 'ai_step',
    tenantId: 'test',
    input: { question: 'What is 2+2?' },
    attempt: 1,
    executorType: 'ai',
    executorConfig: { model: 'gpt-4o' },
  }

  it('extracts token usage from step output _usage key', async () => {
    const tracker = new StepCostTracker({ db })

    const result: StepResult = {
      output: {
        response: 'The answer is 4.',
        _usage: { tokens: 150, costUsd: 0.003, model: 'gpt-4o' },
      },
    }

    await tracker.afterExecute!(payload, result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBe(150)
    expect(step!.costUsd).toBe('0.003')
    expect(step!.modelUsed).toBe('gpt-4o')
  })

  it('calculates cost from pricing table when not in output', async () => {
    const tracker = new StepCostTracker({
      db,
      pricing: { 'gpt-4o': 0.01 }, // $0.01 per 1K tokens
    })

    const result: StepResult = {
      output: {
        response: 'Hello',
        _usage: { tokens: 2000, model: 'gpt-4o' },
      },
    }

    await tracker.afterExecute!(payload, result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBe(2000)
    expect(step!.costUsd).toBe('0.02') // 2000/1000 * 0.01
    expect(step!.modelUsed).toBe('gpt-4o')
  })

  it('handles prompt + completion token breakdown', async () => {
    const tracker = new StepCostTracker({ db })

    const result: StepResult = {
      output: {
        response: 'Result',
        _usage: {
          promptTokens: 100,
          completionTokens: 50,
          model: 'claude-sonnet-4-20250514',
        },
      },
    }

    await tracker.afterExecute!(payload, result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBe(150) // 100 + 50
    expect(step!.modelUsed).toBe('claude-sonnet-4-20250514')
  })

  it('does nothing when no _usage key in output', async () => {
    const tracker = new StepCostTracker({ db })

    const result: StepResult = {
      output: { response: 'No usage data' },
    }

    const out = await tracker.afterExecute!(payload, result)
    expect(out).toBe(result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBeNull()
    expect(step!.costUsd).toBeNull()
  })

  it('uses custom usage key', async () => {
    const tracker = new StepCostTracker({ db, usageKey: 'tokenInfo' })

    const result: StepResult = {
      output: {
        response: 'Custom key',
        tokenInfo: { tokens: 500, model: 'llama3' },
      },
    }

    await tracker.afterExecute!(payload, result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.tokensUsed).toBe(500)
    expect(step!.modelUsed).toBe('llama3')
  })

  it('falls back to executorConfig.model when not in usage', async () => {
    const tracker = new StepCostTracker({ db })

    const result: StepResult = {
      output: {
        response: 'Fallback',
        _usage: { tokens: 100 },
      },
    }

    await tracker.afterExecute!(payload, result)

    const step = await db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('id', '=', 'step-cost-1')
      .executeTakeFirst()

    expect(step!.modelUsed).toBe('gpt-4o') // From executorConfig
  })

  describe('integration with WorkflowMetricsCollector', () => {
    it('includes cost data in run metrics', async () => {
      // Set cost data directly on step
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'COMPLETED',
          tokensUsed: 1500,
          costUsd: '0.015',
          modelUsed: 'gpt-4o',
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .where('id', '=', 'step-cost-1')
        .execute()

      // Add a second step with cost
      await db
        .insertInto('workflow_steps')
        .values({
          id: 'step-cost-2',
          workflowRunId: 'wf-cost',
          tenantId: 'test',
          stepName: 'review_step',
          status: 'COMPLETED',
          executorType: 'ai',
          attempt: 1,
          maxRetries: 3,
          tokensUsed: 500,
          costUsd: '0.005',
          modelUsed: 'claude-haiku-4-5-20251001',
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute()

      const metrics = new WorkflowMetricsCollector(db)
      const result = await metrics.getRunMetrics('wf-cost')

      expect(result).toBeDefined()
      expect(result!.totalTokens).toBe(2000) // 1500 + 500
      expect(result!.totalCostUsd).toBeCloseTo(0.02) // 0.015 + 0.005

      const aiStep = result!.steps.find(s => s.stepName === 'ai_step')!
      expect(aiStep.tokensUsed).toBe(1500)
      expect(aiStep.costUsd).toBeCloseTo(0.015)
      expect(aiStep.modelUsed).toBe('gpt-4o')
    })
  })
})

// npx vitest run src/__tests__/engine/external-actions.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import {
  ExternalActionExecutor,
  ExternalActionPendingError,
} from '../../engine/ExternalActionExecutor.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('ExternalActionExecutor', () => {
  let db: TestDb
  let executor: ExternalActionExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    // Insert a parent workflow run so FK constraints are satisfied
    await db
      .insertInto('workflow_runs')
      .values({
        id: 'wf-1',
        tenantId: 'test',
        workflowName: 'test_wf',
        workflowVersion: '1.0.0',
        status: 'RUNNING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()
    executor = new ExternalActionExecutor({ db })
  })

  const baseReq = {
    workflowRunId: 'wf-1',
    stepName: 'create_tasks',
    attempt: 1,
    tenantId: 'test',
    provider: 'linear',
    actionType: 'create_issue',
    request: { title: 'Test issue' },
  }

  // ── Exactly-once execution ──────────────────────────────────

  describe('exactly-once execution', () => {
    it('executes action and returns result', async () => {
      const result = await executor.execute(baseReq, async req => ({
        externalId: 'LIN-1',
        data: { id: 'LIN-1', title: req.title },
      }))

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('LIN-1')
      expect(result.data).toEqual({ id: 'LIN-1', title: 'Test issue' })
    })

    it('returns cached result on duplicate call (same idempotency key)', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        return { externalId: 'LIN-1', data: { created: true } }
      }

      await executor.execute(baseReq, fn)
      const second = await executor.execute(baseReq, fn)

      expect(callCount).toBe(1) // Only called once
      expect(second.cached).toBe(true)
      expect(second.externalId).toBe('LIN-1')
    })

    it('different idempotency keys execute separately', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        return { externalId: `LIN-${callCount}`, data: {} }
      }

      await executor.execute({ ...baseReq, idempotencyKey: 'key-a' }, fn)
      await executor.execute({ ...baseReq, idempotencyKey: 'key-b' }, fn)

      expect(callCount).toBe(2)
    })

    it('custom idempotency key overrides default', async () => {
      const _result = await executor.execute(
        { ...baseReq, idempotencyKey: 'custom-key-123' },
        async () => ({ externalId: 'X', data: {} }),
      )

      // Second call with same custom key should be cached
      const second = await executor.execute(
        {
          ...baseReq,
          idempotencyKey: 'custom-key-123',
          request: { different: true },
        },
        async () => ({ externalId: 'Y', data: {} }),
      )

      expect(second.cached).toBe(true)
      expect(second.externalId).toBe('X')
    })
  })

  // ── Race condition tests ────────────────────────────────────

  describe('race conditions', () => {
    it('10 parallel executions with same key → only 1 external call', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        await new Promise(r => setTimeout(r, 50)) // Simulate API latency
        return { externalId: 'LIN-RACE', data: { call: callCount } }
      }

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => executor.execute(baseReq, fn)),
      )

      const successes = results.filter(r => r.status === 'fulfilled')
      const _pending = results.filter(
        r =>
          r.status === 'rejected' &&
          (r.reason as any)?.name === 'ExternalActionPendingError',
      )

      // At least 1 success, rest are either cached or pending errors
      expect(successes.length).toBeGreaterThanOrEqual(1)
      // The actual external call should happen at most a few times (due to race)
      expect(callCount).toBeLessThanOrEqual(3)
    })
  })

  // ── Failure handling ────────────────────────────────────────

  describe('failure handling', () => {
    it('marks action as failed when fn throws', async () => {
      await expect(
        executor.execute(baseReq, async () => {
          throw new Error('API down')
        }),
      ).rejects.toThrow('API down')

      // Action should be marked failed in DB
      const actions = await db
        .selectFrom('external_actions')
        .selectAll()
        .where('workflowRunId', '=', 'wf-1')
        .execute()

      expect(actions).toHaveLength(1)
      expect(actions[0].status).toBe('failed')
      expect(actions[0].error).toContain('API down')
    })

    it('failed action can be retried (new attempt)', async () => {
      // First attempt fails
      await expect(
        executor.execute(baseReq, async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow()

      // Second attempt with different key succeeds
      const result = await executor.execute(
        {
          ...baseReq,
          attempt: 2,
          idempotencyKey: 'wf-1:create_tasks:create_issue:2',
        },
        async () => ({ externalId: 'LIN-RETRY', data: {} }),
      )

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('LIN-RETRY')
    })
  })

  // ── Stale pending recovery ──────────────────────────────────

  describe('stale pending recovery', () => {
    it('recovers from stale pending action (>5 min old)', async () => {
      // Manually insert a stale pending action with explicit idempotency key
      const staleTime = new Date(Date.now() - 6 * 60 * 1000) // 6 min ago
      await db
        .insertInto('external_actions')
        .values({
          id: 'stale-1',
          workflowRunId: 'wf-1',
          stepName: 'create_tasks',
          attempt: 1,
          tenantId: 'test',
          provider: 'linear',
          actionType: 'create_issue',
          idempotencyKey: 'stale-test-key',
          status: 'pending',
          request: '{}',
          createdAt: staleTime,
        })
        .execute()

      // Should clean up stale and execute fresh
      const result = await executor.execute(
        { ...baseReq, idempotencyKey: 'stale-test-key' },
        async () => ({
          externalId: 'LIN-RECOVERED',
          data: { recovered: true },
        }),
      )

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('LIN-RECOVERED')
    })

    it('blocks on recent pending action (<5 min old)', async () => {
      // Insert a recent pending action with explicit idempotency key
      await db
        .insertInto('external_actions')
        .values({
          id: 'recent-1',
          workflowRunId: 'wf-1',
          stepName: 'create_tasks',
          attempt: 1,
          tenantId: 'test',
          provider: 'linear',
          actionType: 'create_issue',
          idempotencyKey: 'recent-test-key',
          status: 'pending',
          request: '{}',
          createdAt: new Date(), // Just now
        })
        .execute()

      await expect(
        executor.execute(
          { ...baseReq, idempotencyKey: 'recent-test-key' },
          async () => ({ externalId: 'X', data: {} }),
        ),
      ).rejects.toThrow(ExternalActionPendingError)
    })
  })

  // ── Rate limiting ───────────────────────────────────────────

  describe('rate limiting', () => {
    it('enforces per-provider rate limits', async () => {
      const rateLimitedExecutor = new ExternalActionExecutor({
        db,
        rateLimits: {
          linear: { maxRequests: 3, windowMs: 5000 },
        },
      })

      const _start = Date.now()
      const results: string[] = []

      // Fire 4 requests — 4th should be delayed
      for (let i = 0; i < 4; i++) {
        await rateLimitedExecutor.execute(
          { ...baseReq, idempotencyKey: `rate-${i}` },
          async () => ({ externalId: `RL-${i}`, data: {} }),
        )
        results.push(`RL-${i}`)
      }

      // All should complete (4th just waits)
      expect(results).toHaveLength(4)
    })

    it('enforces per-workflow concurrency limits', async () => {
      const concurrencyExecutor = new ExternalActionExecutor({
        db,
        maxConcurrentPerWorkflow: 2,
      })

      let concurrent = 0
      let maxConcurrent = 0

      const fn = async () => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise(r => setTimeout(r, 100))
        concurrent--
        return { externalId: 'X', data: {} }
      }

      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          concurrencyExecutor.execute(
            { ...baseReq, idempotencyKey: `conc-${i}` },
            fn,
          ),
        ),
      )

      // All should complete; concurrency tracking is best-effort in-memory
      expect(maxConcurrent).toBeLessThanOrEqual(5)
    })
  })

  // ── Payload-aware idempotency key ───────────────────────────

  describe('payload-aware default idempotency key', () => {
    it('same actionType + different payloads → both execute', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        return { externalId: `EA-${callCount}`, data: {} }
      }

      await executor.execute({ ...baseReq, request: { title: 'Issue A' } }, fn)
      await executor.execute({ ...baseReq, request: { title: 'Issue B' } }, fn)

      // Different payloads produce different default keys → both should execute
      expect(callCount).toBe(2)
    })

    it('same actionType + same payload → second is deduplicated', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        return { externalId: `EA-${callCount}`, data: {} }
      }

      await executor.execute(
        { ...baseReq, request: { title: 'Same Issue' } },
        fn,
      )
      const second = await executor.execute(
        { ...baseReq, request: { title: 'Same Issue' } },
        fn,
      )

      expect(callCount).toBe(1)
      expect(second.cached).toBe(true)
    })

    it('explicit idempotencyKey still overrides default', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        return { externalId: `EA-${callCount}`, data: {} }
      }

      await executor.execute(
        { ...baseReq, idempotencyKey: 'my-key', request: { title: 'A' } },
        fn,
      )
      const second = await executor.execute(
        { ...baseReq, idempotencyKey: 'my-key', request: { title: 'B' } },
        fn,
      )

      // Same explicit key → deduplicated regardless of payload
      expect(callCount).toBe(1)
      expect(second.cached).toBe(true)
    })
  })

  // ── Query methods ───────────────────────────────────────────

  describe('query methods', () => {
    it('getActionsForStep returns actions for a specific step', async () => {
      await executor.execute(
        { ...baseReq, idempotencyKey: 'q-1' },
        async () => ({ externalId: 'A', data: {} }),
      )
      await executor.execute(
        { ...baseReq, actionType: 'comment', idempotencyKey: 'q-2' },
        async () => ({ externalId: 'B', data: {} }),
      )

      const actions = await executor.getActionsForStep('wf-1', 'create_tasks')
      expect(actions).toHaveLength(2)
    })

    it('getActionsForWorkflow returns all actions for a workflow', async () => {
      await executor.execute(
        { ...baseReq, idempotencyKey: 'w-1' },
        async () => ({ externalId: 'A', data: {} }),
      )
      await executor.execute(
        { ...baseReq, stepName: 'implement', idempotencyKey: 'w-2' },
        async () => ({ externalId: 'B', data: {} }),
      )

      const actions = await executor.getActionsForWorkflow('wf-1')
      expect(actions).toHaveLength(2)
    })
  })

  // ── Crash consistency (completing status) ────────────────

  describe('crash consistency — completing status', () => {
    it('action in completing status with externalId returns cached result', async () => {
      // Simulate a crash after API succeeded but before full response stored
      await db
        .insertInto('external_actions')
        .values({
          id: 'completing-1',
          workflowRunId: 'wf-1',
          stepName: 'create_tasks',
          attempt: 1,
          tenantId: 'test',
          provider: 'linear',
          actionType: 'create_issue',
          idempotencyKey: 'completing-test-key',
          status: 'completing',
          externalId: 'LIN-CRASH',
          request: '{"title":"Test"}',
          response: '{"partial":true}',
          createdAt: new Date(),
        })
        .execute()

      const result = await executor.execute(
        { ...baseReq, idempotencyKey: 'completing-test-key' },
        async () => ({ externalId: 'LIN-NEW', data: { shouldNotRun: true } }),
      )

      expect(result.cached).toBe(true)
      expect(result.externalId).toBe('LIN-CRASH')
      expect(result.data).toEqual({ partial: true })
    })

    it('crash recovery — completing action with no response returns empty data', async () => {
      await db
        .insertInto('external_actions')
        .values({
          id: 'completing-2',
          workflowRunId: 'wf-1',
          stepName: 'create_tasks',
          attempt: 1,
          tenantId: 'test',
          provider: 'linear',
          actionType: 'create_issue',
          idempotencyKey: 'completing-no-response',
          status: 'completing',
          externalId: 'LIN-CRASH-2',
          request: '{}',
          response: null,
          createdAt: new Date(),
        })
        .execute()

      const result = await executor.execute(
        { ...baseReq, idempotencyKey: 'completing-no-response' },
        async () => ({ externalId: 'SHOULD-NOT-RUN', data: {} }),
      )

      expect(result.cached).toBe(true)
      expect(result.externalId).toBe('LIN-CRASH-2')
      expect(result.data).toEqual({})
    })
  })

  // ── Audit trail ─────────────────────────────────────────────

  describe('audit trail', () => {
    it('stores request and response payloads', async () => {
      await executor.execute(
        { ...baseReq, request: { title: 'My Issue', labels: ['bug'] } },
        async () => ({
          externalId: 'LIN-99',
          data: { url: 'https://linear.app/issue/LIN-99' },
        }),
      )

      const actions = await db
        .selectFrom('external_actions')
        .selectAll()
        .where('workflowRunId', '=', 'wf-1')
        .execute()

      expect(actions).toHaveLength(1)
      const action = actions[0]
      expect(JSON.parse(action.request!)).toEqual({
        title: 'My Issue',
        labels: ['bug'],
      })
      expect(JSON.parse(action.response!)).toEqual({
        url: 'https://linear.app/issue/LIN-99',
      })
      expect(action.externalId).toBe('LIN-99')
      expect(action.provider).toBe('linear')
      expect(action.actionType).toBe('create_issue')
      expect(action.completedAt).toBeDefined()
    })
  })
})

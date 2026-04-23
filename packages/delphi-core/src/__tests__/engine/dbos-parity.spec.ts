// npx vitest run src/__tests__/engine/dbos-parity.spec.ts
//
// Tests for DBOS-parity improvements:
//   1. workflow_step_logs retention (FK CASCADE)
//   2. Atomic budget updates (no race condition)
//   3. INSERT ON CONFLICT for idempotency
//   4. Missing indexes
//   5. @dbRetry decorator
//   6. Transactional step completion
//   8. N+1 fix in listWorkflows
//   9. Migration system
//  10. enqueue_workflow() stored function

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { dbRetry } from '../../engine/dbRetry.js'
import { PgNotifier } from '../../engine/PgNotifier.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { MIGRATIONS, runMigrations } from '../../migrations/runner.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

function createMockConnector() {
  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
  return {
    connector: {
      queue: async (params: any) => {
        queuedJobs.push({
          taskName: params.taskName,
          taskBody: params.taskBody,
        })
        return {
          id: params.uniqueTaskName,
          name: params.taskName,
          status: 'QUEUED',
          output: '',
          attempts: 0,
          created: new Date().toISOString(),
          nextRun: null,
          nextRunMinutes: null,
        }
      },
      getStatus: async () => ({
        id: '',
        name: '',
        status: 'QUEUED' as const,
        output: '',
        attempts: 0,
        created: '',
        nextRun: null,
        nextRunMinutes: null,
        payload: {},
      }),
      forTenant: () => null as any,
    } as any,
    queuedJobs,
  }
}

describe('DBOS Parity Improvements', () => {
  let db: TestDb
  let executor: FunctionStepExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    executor = new FunctionStepExecutor()
    executor.register(
      'echo',
      async (payload: StepPayload): Promise<StepResult> => {
        return { output: { echoed: true, input: payload.input } }
      },
    )
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    opts?: { defaultBudget?: any },
  ) {
    const { connector, queuedJobs } = createMockConnector()
    const workflows = new Map(workflowDefs.map(w => [w.name, w]))
    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows,
      tenantId: 'test-tenant',
      disableLogBuffering: true,
      defaultBudget: opts?.defaultBudget,
    })
    return { engine, queuedJobs }
  }

  async function executeStep(engine: WorkflowEngine, job: any) {
    const payload = job.taskBody as StepPayload
    await db.query(
      'UPDATE workflow_steps SET status = $1, "startedAt" = $2, "updatedAt" = $3 WHERE "workflowRunId" = $4 AND "stepName" = $5 AND status = $6',
      [
        'RUNNING',
        new Date(),
        new Date(),
        payload.workflowRunId,
        payload.stepName,
        'QUEUED',
      ],
    )

    const exec = engine.getExecutor(payload.executorType)!
    try {
      const result = await exec.execute(payload)
      await engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )
    } catch (error) {
      await engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )
    }
  }

  // ── 1. Step log retention ──────────────────────────────────────

  describe('1. workflow_step_logs cleanup via CASCADE', () => {
    it('step logs are deleted when parent workflow run is deleted', async () => {
      const wf = WorkflowBuilder.create('log_retention')
        .step('echo', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'log_retention',
        tenantId: 'test-tenant',
        input: {},
      })

      // Get step and log an event
      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .executeTakeFirst()

      await engine.logStepEvent(
        step!.id,
        'test-tenant',
        'started',
        undefined,
        runId,
      )

      // Verify log exists
      const logsBefore = await db
        .selectFrom('workflow_step_logs')
        .selectAll()
        .where('stepId', '=', step!.id)
        .execute()
      expect(logsBefore.length).toBeGreaterThan(0)

      // Delete the run — CASCADE should clean up logs
      await db.deleteFrom('workflow_runs').where('id', '=', runId).execute()

      // Verify logs are gone
      const logsAfter = await db
        .selectFrom('workflow_step_logs')
        .selectAll()
        .where('stepId', '=', step!.id)
        .execute()
      expect(logsAfter).toHaveLength(0)
    })
  })

  // ── 2. Atomic budget updates ──────────────────────────────────

  describe('2. Atomic budget updates', () => {
    it('concurrent budget increments do not lose updates', async () => {
      const wf = WorkflowBuilder.create('budget_atomic')
        .step('echo', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf], {
        defaultBudget: { maxSteps: 100 },
      })

      const { runId } = await engine.start({
        workflowName: 'budget_atomic',
        tenantId: 'test-tenant',
        input: {},
      })

      // Fire 10 concurrent budget increments
      await Promise.all(
        Array.from({ length: 10 }, () =>
          engine.incrementBudgetUsage(runId, 'steps', 1),
        ),
      )

      const { used } = await engine.getBudgetUsage(runId)
      // With atomic updates, all 10 must be counted
      expect(used.steps).toBe(10)
    })
  })

  // ── 3. INSERT ON CONFLICT idempotency ─────────────────────────

  describe('3. INSERT ON CONFLICT idempotency', () => {
    it('start() with duplicate idempotencyKey returns existing run via upsert', async () => {
      const wf = WorkflowBuilder.create('idemp_upsert')
        .step('echo', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])

      const result1 = await engine.start({
        workflowName: 'idemp_upsert',
        tenantId: 'test-tenant',
        input: { first: true },
        idempotencyKey: 'unique-key-1',
      })

      // Second call with same key — should return existing run, not throw
      const result2 = await engine.start({
        workflowName: 'idemp_upsert',
        tenantId: 'test-tenant',
        input: { second: true },
        idempotencyKey: 'unique-key-1',
      })

      expect(result2.runId).toBe(result1.runId)
    })
  })

  // ── 4. Missing indexes ────────────────────────────────────────

  describe('4. Missing indexes', () => {
    it('traceId index exists on workflow_runs', async () => {
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'workflow_runs'
        AND indexdef LIKE '%traceId%'
      `)
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('createdAt index exists on workflow_runs', async () => {
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'workflow_runs'
        AND indexdef LIKE '%createdAt%'
      `)
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('tenantId+workflowName index exists on workflow_runs', async () => {
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'workflow_runs'
        AND indexdef LIKE '%tenantId%'
        AND indexdef LIKE '%workflowName%'
      `)
      expect(result.rows.length).toBeGreaterThan(0)
    })

    it('partial index on active steps exists', async () => {
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'workflow_steps'
        AND indexname = 'idx_steps_active'
      `)
      expect(result.rows.length).toBeGreaterThan(0)
    })
  })

  // ── 5. @dbRetry decorator ─────────────────────────────────────

  describe('5. dbRetry decorator', () => {
    it('retries on connection error and succeeds', async () => {
      let attempts = 0
      const flaky = async () => {
        attempts++
        if (attempts < 3) {
          const err = new Error('Connection terminated unexpectedly')
          ;(err as any).code = '08006' // connection_failure
          throw err
        }
        return 'success'
      }

      const result = await dbRetry(flaky, { maxRetries: 5, initialDelayMs: 10 })
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('does not retry on non-connection errors', async () => {
      let attempts = 0
      const nonRetryable = async () => {
        attempts++
        throw new Error('Syntax error in SQL')
      }

      await expect(
        dbRetry(nonRetryable, { maxRetries: 5, initialDelayMs: 10 }),
      ).rejects.toThrow('Syntax error in SQL')
      expect(attempts).toBe(1)
    })

    it('gives up after maxRetries', async () => {
      let attempts = 0
      const alwaysFails = async () => {
        attempts++
        const err = new Error('ECONNRESET')
        ;(err as any).code = 'ECONNRESET'
        throw err
      }

      await expect(
        dbRetry(alwaysFails, { maxRetries: 3, initialDelayMs: 10 }),
      ).rejects.toThrow('ECONNRESET')
      expect(attempts).toBe(4) // 1 initial + 3 retries
    })
  })

  // ── 6. Transactional step completion ──────────────────────────

  describe('6. Transactional step completion', () => {
    it('step completion and workflow advance happen atomically', async () => {
      const wf = WorkflowBuilder.create('txn_test')
        .step('echo', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])

      const { runId } = await engine.start({
        workflowName: 'txn_test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute the queued step
      await executeStep(engine, queuedJobs[0])

      // Both step and run should reflect completion
      const status = await engine.getStatus(runId, 'test-tenant')
      const step = status.steps.find(s => s.stepName === 'echo')

      expect(step!.status).toBe('COMPLETED')
      expect(status.status).toBe('COMPLETED')
    })
  })

  // ── 8. N+1 fix in listWorkflows ───────────────────────────────

  describe('8. N+1 fix in listWorkflows', () => {
    it('returns step counts without N+1 queries', async () => {
      const wf = WorkflowBuilder.create('n1_test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .step('step_b', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
          dependsOn: ['step_a'],
        })
        .build()

      const { engine } = createEngine([wf])

      // Create 5 runs
      for (let i = 0; i < 5; i++) {
        await engine.start({
          workflowName: 'n1_test',
          tenantId: 'test-tenant',
          input: { i },
        })
      }

      const runs = await engine.listWorkflows('test-tenant')
      expect(runs).toHaveLength(5)
      // Each run has 2 steps
      for (const run of runs) {
        expect(run.stepCount).toBe(2)
      }
    })
  })

  // ── 7. LISTEN/NOTIFY ───────────────────────────────────────────

  describe('7. PgNotifier LISTEN/NOTIFY', () => {
    it('PgNotifier.parsePayload splits on ::', () => {
      const result = PgNotifier.parsePayload('run123::step_a')
      expect(result.runId).toBe('run123')
      expect(result.name).toBe('step_a')
    })

    it('NOTIFY triggers are created by migration', async () => {
      await runMigrations(db)

      // Check trigger functions exist
      const fns = await db.query<{ proname: string }>(`
        SELECT proname FROM pg_proc
        WHERE proname IN ('delphi_notify_step_completed', 'delphi_notify_signal')
      `)
      expect(fns.rows.length).toBe(2)

      // Check triggers exist
      const triggers = await db.query<{ tgname: string }>(`
        SELECT tgname FROM pg_trigger
        WHERE tgname IN ('trg_delphi_step_completed', 'trg_delphi_signal')
      `)
      expect(triggers.rows.length).toBe(2)
    })
  })

  // ── 9. Migration system ───────────────────────────────────────

  describe('9. Migration system', () => {
    it('MIGRATIONS array is defined and non-empty', () => {
      expect(MIGRATIONS).toBeDefined()
      expect(MIGRATIONS.length).toBeGreaterThan(0)
    })

    it('runMigrations is idempotent', async () => {
      // Running twice should not throw
      await runMigrations(db)
      await runMigrations(db)

      // Check version table exists
      const result = await db.query<{ version: number }>(`
        SELECT version FROM delphi_migrations ORDER BY version DESC LIMIT 1
      `)
      expect(result.rows.length).toBe(1)
      expect(result.rows[0].version).toBeGreaterThan(0)
    })
  })

  // ── 10. enqueue_workflow() stored function ────────────────────

  describe('10. enqueue_workflow() stored function', () => {
    it('function exists in database after migration', async () => {
      await runMigrations(db)

      const result = await db.query<{ proname: string }>(`
        SELECT proname FROM pg_proc
        WHERE proname = 'delphi_enqueue_workflow'
      `)
      expect(result.rows.length).toBe(1)
    })

    it('can enqueue a workflow via SQL', async () => {
      await runMigrations(db)

      // Register a workflow so the run row references a valid name
      const wf = WorkflowBuilder.create('sql_enqueue')
        .step('echo', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()
      createEngine([wf])

      const result = await db.query<{ delphi_enqueue_workflow: string }>(`
        SELECT delphi_enqueue_workflow('sql_enqueue', 'test-tenant', '{"hello":"world"}'::json)
      `)

      const runId = result.rows[0].delphi_enqueue_workflow
      expect(runId).toBeDefined()
      expect(runId.length).toBeGreaterThan(0)

      // Verify the run was created
      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()
      expect(run).toBeDefined()
      expect(run!.workflowName).toBe('sql_enqueue')
      expect(run!.tenantId).toBe('test-tenant')
    })

    it('idempotent — same key returns same runId', async () => {
      await runMigrations(db)

      const r1 = await db.query<{ delphi_enqueue_workflow: string }>(`
        SELECT delphi_enqueue_workflow('sql_idemp', 'test-tenant', '{}'::json, 'dedup-key-1')
      `)

      const r2 = await db.query<{ delphi_enqueue_workflow: string }>(`
        SELECT delphi_enqueue_workflow('sql_idemp', 'test-tenant', '{}'::json, 'dedup-key-1')
      `)

      expect(r1.rows[0].delphi_enqueue_workflow).toBe(
        r2.rows[0].delphi_enqueue_workflow,
      )
    })
  })
})

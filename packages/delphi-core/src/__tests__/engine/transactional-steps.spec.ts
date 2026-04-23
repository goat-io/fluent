// npx vitest run src/__tests__/engine/transactional-steps.spec.ts
//
// Tests for transactional step execution:
//   1. Basic transactional step commits atomically (app write + step completion)
//   2. Rollback on error — neither app writes nor step completion persist
//   3. step() flag overrides class flag
//   4. Class-level transactional flag works alone
//   5. Non-transactional steps unchanged (no ctx.tx)
//   6. Transactional step with waitForHuman
//   7. ctx.tx is present only when transactional
//   8. Budget enforcement still works after transactional commit
//   9. Mixed transactional / non-transactional DAG
//  10. Transactional step retry on failure

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowStepTask } from '../../tasks/WorkflowStepTask.js'
import { FunctionStep } from '../../workflow/Step.js'
import { step, Workflow } from '../../workflow/Workflow.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepExecutionContext,
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

describe('Transactional Steps', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
    // Create the app table used by transactional step tests
    await db.query(`
      CREATE TABLE IF NOT EXISTS test_orders (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL,
        qty INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  })

  afterAll(async () => {
    await db.query('DROP TABLE IF EXISTS test_orders')
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    await db.query('DELETE FROM test_orders')
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    executor: FunctionStepExecutor,
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
      disableStepStatusBuffering: true,
      defaultBudget: opts?.defaultBudget,
    })
    return { engine, queuedJobs }
  }

  // Helper: execute a step through WorkflowStepTask (transactional-aware)
  async function executeStepViaTask(engine: WorkflowEngine, job: any) {
    const task = new WorkflowStepTask(engine)
    const payload = job.taskBody as StepPayload
    return task.handle(payload)
  }

  // Helper: execute step via the old non-transactional path (for comparison)
  async function executeStepManual(engine: WorkflowEngine, job: any) {
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

  // ── 1. Basic transactional step ──────────────────────────────

  describe('1. Basic transactional step commits atomically', () => {
    it('app write and step completion persist together', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'create_order',
        async (
          payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          // Use ctx.tx to write to app table inside the same transaction
          expect(ctx?.tx).toBeDefined()
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            [payload.input.productId, payload.input.qty],
          )
          return { output: { orderId: 'order-1' } }
        },
      )

      const wf = WorkflowBuilder.create('tx_basic')
        .step('create_order', {
          executorType: 'function',
          executorConfig: { handler: 'create_order' },
          transactional: true,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_basic',
        tenantId: 'test-tenant',
        input: { productId: 'widget-1', qty: 3 },
      })

      // Execute the step through WorkflowStepTask
      await executeStepViaTask(engine, queuedJobs[0])

      // Verify step is COMPLETED
      const { rows: steps } = await db.query(
        'SELECT status, output FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(steps[0].status).toBe('COMPLETED')
      expect(JSON.parse(steps[0].output)).toEqual({ orderId: 'order-1' })

      // Verify app write persisted
      const { rows: orders } = await db.query(
        'SELECT * FROM test_orders WHERE product_id = $1',
        ['widget-1'],
      )
      expect(orders).toHaveLength(1)
      expect(orders[0].qty).toBe(3)
    })
  })

  // ── 2. Rollback on error ─────────────────────────────────────

  describe('2. Rollback on error', () => {
    it('neither app writes nor step completion persist on failure', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'failing_order',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          // Write to app table via tx
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            ['should-not-exist', 1],
          )
          // Then throw — both the app write and step completion should be rolled back
          throw new Error('Payment processor declined')
        },
      )

      const wf = WorkflowBuilder.create('tx_rollback')
        .step('failing_order', {
          executorType: 'function',
          executorConfig: { handler: 'failing_order' },
          transactional: true,
          retries: 0,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_rollback',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute — should throw
      await expect(executeStepViaTask(engine, queuedJobs[0])).rejects.toThrow(
        'Payment processor declined',
      )

      // Verify step is FAILED (set by onStepFailed after rollback)
      const { rows: steps } = await db.query(
        'SELECT status FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(steps[0].status).toBe('FAILED')

      // Verify app write was rolled back
      const { rows: orders } = await db.query(
        'SELECT * FROM test_orders WHERE product_id = $1',
        ['should-not-exist'],
      )
      expect(orders).toHaveLength(0)
    })
  })

  // ── 3. step() flag overrides class flag ──────────────────────

  describe('3. step() flag overrides class flag', () => {
    it('step() transactional=false overrides class transactional=true', async () => {
      let receivedTx: any = 'not-called'

      const executor = new FunctionStepExecutor()
      executor.register(
        'tx_override.check_tx',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          receivedTx = ctx?.tx
          return { output: { checked: true } }
        },
      )

      // Class declares transactional=true, but step() overrides to false
      class TxStep extends FunctionStep<
        { checked?: boolean },
        { checked: boolean }
      > {
        stepName = 'check_tx' as const
        transactional = true as const
        async handle() {
          return { output: { checked: true } }
        }
      }

      class OverrideWorkflow extends Workflow<{ checked?: boolean }> {
        workflowName = 'tx_override' as const
        steps = [step(TxStep, { transactional: false })] as const
      }

      const wfInstance = new OverrideWorkflow()
      const def = wfInstance.toDefinition()

      // Verify the definition merged correctly — step() wins
      expect(def.steps[0].transactional).toBe(false)

      const { engine, queuedJobs } = createEngine([def], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_override',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute via manual path (non-transactional since flag=false)
      await executeStepManual(engine, queuedJobs[0])

      // ctx.tx should be undefined since transactional was overridden to false
      expect(receivedTx).toBeUndefined()

      const { rows: steps } = await db.query(
        'SELECT status FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(steps[0].status).toBe('COMPLETED')
    })
  })

  // ── 4. Class-level transactional flag ────────────────────────

  describe('4. Class-level transactional flag works alone', () => {
    it('class transactional=true propagates to definition without step() override', async () => {
      class TxByDefault extends FunctionStep<{ x?: number }, { y: number }> {
        stepName = 'auto_tx' as const
        transactional = true as const
        async handle() {
          return { output: { y: 1 } }
        }
      }

      class AutoTxWorkflow extends Workflow<{ x?: number }> {
        workflowName = 'auto_tx_wf' as const
        steps = [TxByDefault] as const
      }

      const wfInstance = new AutoTxWorkflow()
      const def = wfInstance.toDefinition()
      expect(def.steps[0].transactional).toBe(true)
    })
  })

  // ── 5. Non-transactional steps unchanged ─────────────────────

  describe('5. Non-transactional steps have no ctx.tx', () => {
    it('ctx.tx is undefined for normal steps', async () => {
      let receivedTx: any = 'not-called'

      const executor = new FunctionStepExecutor()
      executor.register(
        'no_tx',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          receivedTx = ctx?.tx
          return { output: { done: true } }
        },
      )

      const wf = WorkflowBuilder.create('no_tx_wf')
        .step('no_tx', {
          executorType: 'function',
          executorConfig: { handler: 'no_tx' },
          // transactional NOT set — defaults to undefined/false
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      await engine.start({
        workflowName: 'no_tx_wf',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute via WorkflowStepTask — should take default path
      await executeStepViaTask(engine, queuedJobs[0])

      expect(receivedTx).toBeUndefined()
    })
  })

  // ── 6. Transactional step with waitForHuman ──────────────────

  describe('6. Transactional step with waitForHuman', () => {
    it('app write + WAITING_HUMAN status committed atomically', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'human_gate',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          expect(ctx?.tx).toBeDefined()
          // App write inside tx
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            ['needs-approval', 1],
          )
          return {
            output: { prepared: true },
            waitForHuman: {
              prompt: 'Approve this order?',
              schema: { type: 'object' },
            },
          }
        },
      )

      const wf = WorkflowBuilder.create('tx_human')
        .step('human_gate', {
          executorType: 'function',
          executorConfig: { handler: 'human_gate' },
          transactional: true,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_human',
        tenantId: 'test-tenant',
        input: {},
      })

      await executeStepViaTask(engine, queuedJobs[0])

      // Verify step is WAITING_HUMAN
      const { rows: steps } = await db.query(
        'SELECT status, output, "humanPrompt" FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(steps[0].status).toBe('WAITING_HUMAN')
      expect(JSON.parse(steps[0].output)).toEqual({ prepared: true })
      expect(JSON.parse(steps[0].humanPrompt)).toEqual({
        prompt: 'Approve this order?',
        schema: { type: 'object' },
      })

      // Verify app write persisted (was inside same tx)
      const { rows: orders } = await db.query(
        'SELECT * FROM test_orders WHERE product_id = $1',
        ['needs-approval'],
      )
      expect(orders).toHaveLength(1)
    })
  })

  // ── 7. ctx.tx is a real PoolClient ───────────────────────────

  describe('7. ctx.tx is a real PoolClient with query capabilities', () => {
    it('can execute queries and see uncommitted writes from the same tx', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'tx_query',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          // Insert via tx
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            ['tx-visible', 5],
          )
          // Read back via same tx — should see uncommitted row
          const { rows } = await ctx!.tx!.query(
            'SELECT qty FROM test_orders WHERE product_id = $1',
            ['tx-visible'],
          )
          return { output: { qty: rows[0]?.qty ?? 0 } }
        },
      )

      const wf = WorkflowBuilder.create('tx_query_wf')
        .step('tx_query', {
          executorType: 'function',
          executorConfig: { handler: 'tx_query' },
          transactional: true,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      await engine.start({
        workflowName: 'tx_query_wf',
        tenantId: 'test-tenant',
        input: {},
      })

      const result = await executeStepViaTask(engine, queuedJobs[0])
      expect(result).toEqual({ qty: 5 })
    })
  })

  // ── 8. Budget enforcement after transactional commit ─────────

  describe('8. Budget enforcement still works', () => {
    it('budget increments after transactional step commit', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'budget_step',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          expect(ctx?.tx).toBeDefined()
          return { output: { done: true } }
        },
      )

      const wf = WorkflowBuilder.create('tx_budget')
        .step('budget_step', {
          executorType: 'function',
          executorConfig: { handler: 'budget_step' },
          transactional: true,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor, {
        defaultBudget: { maxSteps: 5 },
      })
      const { runId } = await engine.start({
        workflowName: 'tx_budget',
        tenantId: 'test-tenant',
        input: {},
      })

      await executeStepViaTask(engine, queuedJobs[0])

      // Step should be completed
      const { rows: steps } = await db.query(
        'SELECT status FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(steps[0].status).toBe('COMPLETED')

      // Budget should have been incremented
      const { rows: runs } = await db.query(
        'SELECT "budgetUsed" FROM workflow_runs WHERE id = $1',
        [runId],
      )
      const budgetUsed = JSON.parse(runs[0].budgetUsed ?? '{}')
      expect(budgetUsed.steps).toBe(1)
    })
  })

  // ── 9. Mixed transactional / non-transactional DAG ───────────

  describe('9. Mixed transactional and non-transactional in same DAG', () => {
    it('transactional and non-transactional steps coexist', async () => {
      let txStepGotTx = false
      let normalStepGotTx = false

      const executor = new FunctionStepExecutor()
      executor.register(
        'tx_step',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          txStepGotTx = !!ctx?.tx
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            ['mixed-tx', 1],
          )
          return { output: { fromTx: true } }
        },
      )
      executor.register(
        'normal_step',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          normalStepGotTx = !!ctx?.tx
          return { output: { fromNormal: true } }
        },
      )

      const wf = WorkflowBuilder.create('mixed_dag')
        .step('tx_step', {
          executorType: 'function',
          executorConfig: { handler: 'tx_step' },
          transactional: true,
        })
        .step('normal_step', {
          executorType: 'function',
          executorConfig: { handler: 'normal_step' },
          dependsOn: ['tx_step'],
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'mixed_dag',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute transactional step first
      await executeStepViaTask(engine, queuedJobs[0])
      expect(txStepGotTx).toBe(true)

      // Verify app write persisted
      const { rows: orders } = await db.query(
        'SELECT * FROM test_orders WHERE product_id = $1',
        ['mixed-tx'],
      )
      expect(orders).toHaveLength(1)

      // Next step should be queued now
      const { rows: nextSteps } = await db.query(
        'SELECT status, "stepName" FROM workflow_steps WHERE "workflowRunId" = $1 AND "stepName" = $2',
        [runId, 'normal_step'],
      )
      // Should have been dispatched (QUEUED or PENDING depending on dispatch)
      expect(['QUEUED', 'PENDING']).toContain(nextSteps[0]?.status)

      // If queued, execute it
      if (queuedJobs.length > 1) {
        await executeStepViaTask(engine, queuedJobs[1])
        expect(normalStepGotTx).toBe(false)
      }
    })
  })

  // ── 10. Transactional step retry on failure ──────────────────

  describe('10. Transactional step retry preserves clean state', () => {
    it('failed transactional step can be retried cleanly', async () => {
      let callCount = 0

      const executor = new FunctionStepExecutor()
      executor.register(
        'retry_step',
        async (
          _payload: StepPayload,
          ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          callCount++
          // Insert an order in each attempt — only the successful one should persist
          await ctx!.tx!.query(
            'INSERT INTO test_orders (product_id, qty) VALUES ($1, $2)',
            [`retry-attempt-${callCount}`, callCount],
          )
          if (callCount === 1) {
            throw new Error('Transient failure')
          }
          return { output: { attempt: callCount } }
        },
      )

      const wf = WorkflowBuilder.create('tx_retry')
        .step('retry_step', {
          executorType: 'function',
          executorConfig: { handler: 'retry_step' },
          transactional: true,
          retries: 2,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_retry',
        tenantId: 'test-tenant',
        input: {},
      })

      // First attempt fails
      await expect(executeStepViaTask(engine, queuedJobs[0])).rejects.toThrow(
        'Transient failure',
      )

      // First attempt's app write should have been rolled back
      const { rows: ordersAfterFail } = await db.query(
        'SELECT * FROM test_orders WHERE product_id = $1',
        ['retry-attempt-1'],
      )
      expect(ordersAfterFail).toHaveLength(0)

      // Step should be re-queued for retry (attempt incremented from 0 to 1)
      const { rows: stepAfterFail } = await db.query(
        'SELECT status, attempt FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(stepAfterFail[0].status).toBe('QUEUED')
      expect(stepAfterFail[0].attempt).toBe(1)

      // Build retry payload with incremented attempt
      const retryPayload = {
        ...queuedJobs[0].taskBody,
        attempt: stepAfterFail[0].attempt,
      }

      // Second attempt succeeds
      await executeStepViaTask(engine, { taskBody: retryPayload })

      // Only the second attempt's order should exist
      const { rows: ordersAfterSuccess } = await db.query(
        "SELECT * FROM test_orders WHERE product_id LIKE 'retry-attempt-%'",
        [],
      )
      expect(ordersAfterSuccess).toHaveLength(1)
      expect(ordersAfterSuccess[0].product_id).toBe('retry-attempt-2')

      // Step should be COMPLETED
      const { rows: stepAfterSuccess } = await db.query(
        'SELECT status FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      expect(stepAfterSuccess[0].status).toBe('COMPLETED')
    })
  })

  // ── 11. Step log recorded inside transaction ─────────────────

  describe('11. Step event log recorded in transaction', () => {
    it('step completion event is logged', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'log_check',
        async (
          _payload: StepPayload,
          _ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          return { output: { logged: true } }
        },
      )

      const wf = WorkflowBuilder.create('tx_log')
        .step('log_check', {
          executorType: 'function',
          executorConfig: { handler: 'log_check' },
          transactional: true,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_log',
        tenantId: 'test-tenant',
        input: {},
      })

      await executeStepViaTask(engine, queuedJobs[0])

      // Verify step log was recorded
      const { rows: logs } = await db.query(
        `SELECT event, data FROM workflow_step_logs WHERE "workflowRunId" = $1 ORDER BY "createdAt"`,
        [runId],
      )
      const completedLog = logs.find((l: any) => l.event === 'completed')
      expect(completedLog).toBeDefined()
      expect(JSON.parse(completedLog!.data)).toEqual({
        outputKeys: ['logged'],
      })
    })
  })

  // ── 12. Rollback also rolls back step log ────────────────────

  describe('12. Rollback also prevents step log', () => {
    it('no step log on failure (rolled back with everything else)', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'log_fail',
        async (
          _payload: StepPayload,
          _ctx?: StepExecutionContext,
        ): Promise<StepResult> => {
          throw new Error('Boom')
        },
      )

      const wf = WorkflowBuilder.create('tx_log_fail')
        .step('log_fail', {
          executorType: 'function',
          executorConfig: { handler: 'log_fail' },
          transactional: true,
          retries: 0,
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf], executor)
      const { runId } = await engine.start({
        workflowName: 'tx_log_fail',
        tenantId: 'test-tenant',
        input: {},
      })

      await expect(executeStepViaTask(engine, queuedJobs[0])).rejects.toThrow(
        'Boom',
      )

      // The 'completed' log should NOT exist (was inside rolled-back tx)
      // But 'failed' log from onStepFailed should exist (outside tx)
      // Note: onStepFailed logs by stepId, not always with workflowRunId
      const { rows: stepRows } = await db.query(
        'SELECT id FROM workflow_steps WHERE "workflowRunId" = $1',
        [runId],
      )
      const { rows: logs } = await db.query(
        `SELECT event FROM workflow_step_logs WHERE "stepId" = $1`,
        [stepRows[0].id],
      )
      const events = logs.map((l: any) => l.event)
      expect(events).not.toContain('completed')
      expect(events).toContain('failed')
    })
  })
})

// npx vitest run src/__tests__/engine/saga-rollback.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
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
      }),
    },
    queuedJobs,
  }
}

describe('saga rollback', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
  })

  /** Mark a step as RUNNING (normally the worker does this) */
  async function markRunning(runId: string, stepName: string) {
    await db.query(
      `UPDATE workflow_steps SET status = 'RUNNING', "startedAt" = NOW(), "updatedAt" = NOW() WHERE "workflowRunId" = $1 AND "stepName" = $2 AND status = 'QUEUED'`,
      [runId, stepName],
    )
  }

  it('executes rollback handlers in reverse topological order when workflow fails', async () => {
    const rollbackLog: string[] = []

    // Build a 3-step linear workflow: charge → reserve → notify
    // charge and reserve have rollbacks; notify will fail
    const def = WorkflowBuilder.create('saga_test')
      .defaultRetries(0) // fail immediately, no retries
      .step('charge', {
        executorType: 'function',
        executorConfig: { handler: 'saga_test.charge' },
      })
      .step('reserve', {
        executorType: 'function',
        executorConfig: { handler: 'saga_test.reserve' },
        dependsOn: ['charge'],
      })
      .step('notify', {
        executorType: 'function',
        executorConfig: { handler: 'saga_test.notify' },
        dependsOn: ['reserve'],
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()
    executor.register('saga_test.charge', async () => ({
      output: { chargeId: 'ch_123' },
    }))
    executor.register('saga_test.reserve', async () => ({
      output: { reservationId: 'res_456' },
    }))
    executor.register('saga_test.notify', async () => {
      throw new Error('email service down')
    })

    // Rollback handlers
    const rollbackHandlers = new Map<
      string,
      (
        input: Record<string, unknown>,
        output: Record<string, unknown>,
      ) => Promise<void>
    >()
    rollbackHandlers.set('saga_test.charge', async (_input, output) => {
      rollbackLog.push(`refund:${output.chargeId}`)
    })
    rollbackHandlers.set('saga_test.reserve', async (_input, output) => {
      rollbackLog.push(`unreserve:${output.reservationId}`)
    })

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['saga_test', def]]),
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
      rollbackHandlers,
    })

    // Start workflow
    const { runId } = await engine.start({
      workflowName: 'saga_test',
      tenantId: 'test',
      input: {},
    })

    // Complete charge step
    await markRunning(runId, 'charge')
    await engine.onStepCompleted(runId, 'charge', 'test', {
      output: { chargeId: 'ch_123' },
    })

    // Complete reserve step
    await markRunning(runId, 'reserve')
    await engine.onStepCompleted(runId, 'reserve', 'test', {
      output: { reservationId: 'res_456' },
    })

    // Fail notify step (0 retries = terminal failure)
    await markRunning(runId, 'notify')
    await engine.onStepFailed(
      runId,
      'notify',
      'test',
      new Error('email service down'),
    )

    // Verify rollbacks ran in reverse order: reserve first, then charge
    expect(rollbackLog).toEqual(['unreserve:res_456', 'refund:ch_123'])

    // Verify append-only history: step statuses unchanged
    const { rows: steps } = await db.query<any>(
      `SELECT "stepName", status FROM workflow_steps WHERE "workflowRunId" = $1 ORDER BY "stepName"`,
      [runId],
    )
    const statusMap = Object.fromEntries(
      steps.map((s: any) => [s.stepName, s.status]),
    )
    expect(statusMap.charge).toBe('COMPLETED') // NOT rolled back — history preserved
    expect(statusMap.reserve).toBe('COMPLETED') // NOT rolled back — history preserved
    expect(statusMap.notify).toBe('FAILED')

    // Verify rollback events logged
    const { rows: logs } = await db.query<any>(
      `SELECT event, data FROM workflow_step_logs WHERE "workflowRunId" = $1 AND event LIKE 'rollback%' ORDER BY "createdAt"`,
      [runId],
    )
    expect(logs).toHaveLength(4) // started + completed for each of 2 steps
    const events = logs.map((l: any) => l.event)
    expect(events).toEqual([
      'rollback_started',
      'rollback_completed',
      'rollback_started',
      'rollback_completed',
    ])
  })

  it('continues rollback chain when one rollback fails', async () => {
    const rollbackLog: string[] = []

    const def = WorkflowBuilder.create('partial_rollback')
      .defaultRetries(0)
      .step('step_a', {
        executorType: 'function',
        executorConfig: { handler: 'partial_rollback.step_a' },
      })
      .step('step_b', {
        executorType: 'function',
        executorConfig: { handler: 'partial_rollback.step_b' },
        dependsOn: ['step_a'],
      })
      .step('step_c', {
        executorType: 'function',
        executorConfig: { handler: 'partial_rollback.step_c' },
        dependsOn: ['step_b'],
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()
    executor.register('partial_rollback.step_a', async () => ({
      output: { a: 1 },
    }))
    executor.register('partial_rollback.step_b', async () => ({
      output: { b: 2 },
    }))
    executor.register('partial_rollback.step_c', async () => {
      throw new Error('fail')
    })

    const rollbackHandlers = new Map<
      string,
      (
        input: Record<string, unknown>,
        output: Record<string, unknown>,
      ) => Promise<void>
    >()
    // step_b rollback will throw
    rollbackHandlers.set('partial_rollback.step_b', async () => {
      rollbackLog.push('step_b:attempted')
      throw new Error('rollback also failed')
    })
    // step_a rollback should still run
    rollbackHandlers.set('partial_rollback.step_a', async () => {
      rollbackLog.push('step_a:rolled_back')
    })

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['partial_rollback', def]]),
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
      rollbackHandlers,
    })

    const { runId } = await engine.start({
      workflowName: 'partial_rollback',
      tenantId: 'test',
      input: {},
    })

    await markRunning(runId, 'step_a')
    await engine.onStepCompleted(runId, 'step_a', 'test', { output: { a: 1 } })
    await markRunning(runId, 'step_b')
    await engine.onStepCompleted(runId, 'step_b', 'test', { output: { b: 2 } })
    await markRunning(runId, 'step_c')
    await engine.onStepFailed(runId, 'step_c', 'test', new Error('fail'))

    // Both rollbacks attempted, despite step_b's failure
    expect(rollbackLog).toEqual(['step_b:attempted', 'step_a:rolled_back'])

    // Verify rollback_failed event logged for step_b
    const { rows: logs } = await db.query<any>(
      `SELECT event, data FROM workflow_step_logs WHERE "workflowRunId" = $1 AND event LIKE 'rollback%' ORDER BY "createdAt"`,
      [runId],
    )
    const events = logs.map((l: any) => l.event)
    expect(events).toContain('rollback_failed')
    expect(events).toContain('rollback_completed')
  })

  it('skips rollback when no handlers are registered', async () => {
    const def = WorkflowBuilder.create('no_rollback')
      .defaultRetries(0)
      .step('work', {
        executorType: 'function',
        executorConfig: { handler: 'no_rollback.work' },
      })
      .step('fail', {
        executorType: 'function',
        executorConfig: { handler: 'no_rollback.fail' },
        dependsOn: ['work'],
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()
    executor.register('no_rollback.work', async () => ({
      output: { ok: true },
    }))

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['no_rollback', def]]),
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
      // no rollbackHandlers
    })

    const { runId } = await engine.start({
      workflowName: 'no_rollback',
      tenantId: 'test',
      input: {},
    })

    await markRunning(runId, 'work')
    await engine.onStepCompleted(runId, 'work', 'test', {
      output: { ok: true },
    })
    await markRunning(runId, 'fail')
    await engine.onStepFailed(runId, 'fail', 'test', new Error('boom'))

    // No rollback events
    const { rows: logs } = await db.query<any>(
      `SELECT event FROM workflow_step_logs WHERE "workflowRunId" = $1 AND event LIKE 'rollback%'`,
      [runId],
    )
    expect(logs).toHaveLength(0)

    // Workflow still marked as FAILED
    const { rows: runs } = await db.query<any>(
      `SELECT status FROM workflow_runs WHERE id = $1`,
      [runId],
    )
    expect(runs[0].status).toBe('FAILED')
  })

  it('realistic e-commerce: charge → reserve → ship, ship fails, refund + unreserve', async () => {
    // Simulates a real payment flow where the shipping step fails after
    // payment was charged and inventory reserved. Rollback must refund
    // the charge and unreserve inventory, in that order (reverse topo).

    // Tracks what the rollback handlers actually did (simulating external API calls)
    const externalState = {
      chargeRefunded: false,
      reservationCancelled: false,
    }

    const def = WorkflowBuilder.create('checkout')
      .defaultRetries(1) // 1 retry before giving up
      .step('charge_card', {
        executorType: 'function',
        executorConfig: { handler: 'checkout.charge_card' },
      })
      .step('reserve_inventory', {
        executorType: 'function',
        executorConfig: { handler: 'checkout.reserve_inventory' },
        dependsOn: ['charge_card'],
      })
      .step('create_shipment', {
        executorType: 'function',
        executorConfig: { handler: 'checkout.create_shipment' },
        dependsOn: ['reserve_inventory'],
      })
      .build()

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()

    // Handlers registered for the executor (called during real execution).
    // In tests we call onStepCompleted/onStepFailed directly, so these
    // only matter for type registration, not for actual execution.
    executor.register('checkout.charge_card', async () => ({
      output: { chargeId: 'ch_live_abc', amount: 4200 },
    }))
    executor.register('checkout.reserve_inventory', async () => ({
      output: { reservationId: 'res_live_xyz', sku: 'WIDGET-42' },
    }))
    executor.register('checkout.create_shipment', async () => {
      throw new Error('Carrier API: service unavailable')
    })

    const rollbackHandlers = new Map<
      string,
      (
        input: Record<string, unknown>,
        output: Record<string, unknown>,
      ) => Promise<void>
    >()
    rollbackHandlers.set('checkout.charge_card', async (_input, output) => {
      // Simulate Stripe refund
      expect(output.chargeId).toBe('ch_live_abc')
      externalState.chargeRefunded = true
    })
    rollbackHandlers.set(
      'checkout.reserve_inventory',
      async (_input, output) => {
        // Simulate inventory API call
        expect(output.reservationId).toBe('res_live_xyz')
        externalState.reservationCancelled = true
      },
    )

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['checkout', def]]),
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
      rollbackHandlers,
    })

    const { runId } = await engine.start({
      workflowName: 'checkout',
      tenantId: 'test',
      input: { orderId: 'ord_999', customerId: 'cus_alice' },
    })

    // Step 1: charge succeeds
    await markRunning(runId, 'charge_card')
    await engine.onStepCompleted(runId, 'charge_card', 'test', {
      output: { chargeId: 'ch_live_abc', amount: 4200 },
    })

    // Step 2: reserve succeeds
    await markRunning(runId, 'reserve_inventory')
    await engine.onStepCompleted(runId, 'reserve_inventory', 'test', {
      output: { reservationId: 'res_live_xyz', sku: 'WIDGET-42' },
    })

    // Step 3: ship fails — first attempt
    await markRunning(runId, 'create_shipment')
    await engine.onStepFailed(
      runId,
      'create_shipment',
      'test',
      new Error('Carrier API: service unavailable'),
    )

    // With 1 retry, step is retried (attempt incremented)
    const { rows: stepAfterRetry } = await db.query<any>(
      `SELECT attempt, "maxRetries" FROM workflow_steps WHERE "workflowRunId" = $1 AND "stepName" = 'create_shipment'`,
      [runId],
    )
    expect(stepAfterRetry[0].attempt).toBe(1)
    expect(stepAfterRetry[0].maxRetries).toBe(1)
    // No rollback yet — retries not exhausted
    expect(externalState.chargeRefunded).toBe(false)

    // Step 3: ship fails AGAIN — retries now exhausted (attempt 1 >= maxRetries 1)
    await engine.onStepFailed(
      runId,
      'create_shipment',
      'test',
      new Error('Carrier API: still down'),
    )

    // NOW rollbacks should have fired
    expect(externalState.chargeRefunded).toBe(true)
    expect(externalState.reservationCancelled).toBe(true)

    // Workflow is FAILED
    const { rows: runs } = await db.query<any>(
      `SELECT status, error FROM workflow_runs WHERE id = $1`,
      [runId],
    )
    expect(runs[0].status).toBe('FAILED')
    expect(runs[0].error).toContain('Carrier API')

    // Append-only: completed steps still show COMPLETED
    const { rows: allSteps } = await db.query<any>(
      `SELECT "stepName", status FROM workflow_steps WHERE "workflowRunId" = $1 ORDER BY "createdAt"`,
      [runId],
    )
    const stepStatus = Object.fromEntries(
      allSteps.map((s: any) => [s.stepName, s.status]),
    )
    expect(stepStatus.charge_card).toBe('COMPLETED')
    expect(stepStatus.reserve_inventory).toBe('COMPLETED')
    expect(stepStatus.create_shipment).toBe('FAILED')

    // Full rollback audit trail exists
    const { rows: auditLogs } = await db.query<any>(
      `SELECT event, data FROM workflow_step_logs WHERE "workflowRunId" = $1 AND event LIKE 'rollback%' ORDER BY "createdAt"`,
      [runId],
    )
    expect(auditLogs.length).toBe(4) // 2 steps × (started + completed)
    // Reverse topo order: reserve_inventory rolled back before charge_card
    const rollbackStepNames = auditLogs
      .filter((l: any) => l.event === 'rollback_started')
      .map((l: any) => JSON.parse(l.data).stepName)
    expect(rollbackStepNames).toEqual(['reserve_inventory', 'charge_card'])
  })

  it('calls onRollbackFailed callback for alerting when a rollback throws', async () => {
    const alerts: Array<{ stepName: string; error: string }> = []

    const def = WorkflowBuilder.create('alert_rollback')
      .defaultRetries(0)
      .step('pay', {
        executorType: 'function',
        executorConfig: { handler: 'alert_rollback.pay' },
      })
      .step('ship', {
        executorType: 'function',
        executorConfig: { handler: 'alert_rollback.ship' },
        dependsOn: ['pay'],
      })
      .build()

    // Attach onRollbackFailed to the definition
    def.onRollbackFailed = async ctx => {
      alerts.push({ stepName: ctx.stepName, error: ctx.rollbackError.message })
    }

    const { connector } = createMockConnector()
    const executor = new FunctionStepExecutor()
    executor.register('alert_rollback.pay', async () => ({
      output: { paid: true },
    }))

    const rollbackHandlers = new Map<
      string,
      (
        input: Record<string, unknown>,
        output: Record<string, unknown>,
      ) => Promise<void>
    >()
    rollbackHandlers.set('alert_rollback.pay', async () => {
      throw new Error('Stripe refund API timeout')
    })

    const engine = new WorkflowEngine({
      db,
      workflows: new Map([['alert_rollback', def]]),
      executors: new Map([['function', executor]]),
      connector: connector as any,
      tenantId: 'test',
      disableLogBuffering: true,
      rollbackHandlers,
    })

    const { runId } = await engine.start({
      workflowName: 'alert_rollback',
      tenantId: 'test',
      input: {},
    })

    await markRunning(runId, 'pay')
    await engine.onStepCompleted(runId, 'pay', 'test', {
      output: { paid: true },
    })
    await markRunning(runId, 'ship')
    await engine.onStepFailed(runId, 'ship', 'test', new Error('carrier down'))

    // onRollbackFailed was called with the right context
    expect(alerts).toHaveLength(1)
    expect(alerts[0].stepName).toBe('pay')
    expect(alerts[0].error).toBe('Stripe refund API timeout')
  })
})

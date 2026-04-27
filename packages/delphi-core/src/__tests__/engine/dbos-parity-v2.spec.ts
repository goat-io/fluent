// npx vitest run src/__tests__/engine/dbos-parity-v2.spec.ts
//
// Tests for DBOS-parity v2 features:
//   1. Durable Sleep
//   2. Timeout Enforcement
//   3. Workflow Forking
//   4. Input Validation
//   5. Workflow Streaming
//   6. Version-Aware Dispatch
//   7. Instant Delayed Execution
//   8. Adaptive Queue Polling
//   9. Queue Partitioning
//  10. Dual-Mode GC

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { AdaptivePoller } from '../../engine/AdaptivePoller.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { InputValidationError } from '../../errors/WorkflowErrors.js'
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

describe('DBOS-parity v2', () => {
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
    executor.register(
      'transform',
      async (payload: StepPayload): Promise<StepResult> => {
        return { output: { transformed: true, data: payload.input } }
      },
    )
    executor.register(
      'finalize',
      async (_payload: StepPayload): Promise<StepResult> => {
        return { output: { finalized: true } }
      },
    )
  })

  function createEngine(
    workflowDefs: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    overrides: Partial<ConstructorParameters<typeof WorkflowEngine>[0]> = {},
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
      ...overrides,
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

  // ── 1. Durable Sleep ──────────────────────────────────────────────

  describe('durable sleep', () => {
    it('records deadlineEpochMs and sets step to SLEEPING, then wakes up', async () => {
      const wf = WorkflowBuilder.create('sleep-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'sleep-test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Execute step_a to RUNNING state
      const _job = queuedJobs[0]!
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'step_a')
        .execute()

      // Start a short durable sleep (50ms)
      const before = Date.now()
      await engine.durableSleep(runId, 'step_a', 'test-tenant', 50)
      const elapsed = Date.now() - before

      // Verify the sleep happened (~50ms, allow some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(30)

      // Verify step is back to RUNNING after sleep
      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'step_a')
        .executeTakeFirst()

      expect(step!.status).toBe('RUNNING')
      // deadlineEpochMs should have been set (still stored)
      expect(step!.deadlineEpochMs).not.toBeNull()
    })

    it('resumeDurableSleep sleeps only remaining time', async () => {
      const wf = WorkflowBuilder.create('sleep-resume')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'sleep-resume',
        tenantId: 'test-tenant',
        input: {},
      })

      // Put step into SLEEPING with a deadline 50ms from now
      const deadline = Date.now() + 50
      await db
        .updateTable('workflow_steps')
        .set({
          status: 'SLEEPING',
          deadlineEpochMs: String(deadline),
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'step_a')
        .execute()

      const before = Date.now()
      await engine.resumeDurableSleep(runId, 'step_a', 'test-tenant')
      const elapsed = Date.now() - before

      // Should have slept some remaining time
      expect(elapsed).toBeGreaterThanOrEqual(10)

      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'step_a')
        .executeTakeFirst()

      expect(step!.status).toBe('RUNNING')
    })
  })

  // ── 2. Timeout Enforcement ─────────────────────────────────────────

  describe('timeout enforcement', () => {
    it('sweepTimedOutWorkflows marks RUNNING runs past deadline as FAILED', async () => {
      const wf = WorkflowBuilder.create('timeout-test')
        .defaultTimeout(100) // 100ms timeout
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'timeout-test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Set the deadline to the past to simulate timeout
      await db
        .updateTable('workflow_runs')
        .set({
          deadlineEpochMs: String(Date.now() - 1000),
          updatedAt: new Date(),
        })
        .where('id', '=', runId)
        .execute()

      const swept = await engine.sweepTimedOutWorkflows()
      expect(swept).toBe(1)

      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()

      expect(run!.status).toBe('FAILED')
      expect(run!.error).toBe('Workflow timeout exceeded')
    })

    it('sweepTimedOutSteps marks RUNNING steps past heartbeat timeout as FAILED', async () => {
      const wf = WorkflowBuilder.create('step-timeout-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
          heartbeatTimeoutMs: 100,
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'step-timeout-test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Set step to RUNNING with an old heartbeat (use SQL NOW() to avoid clock skew with Docker Postgres)
      await db.query(
        `UPDATE workflow_steps
        SET status = 'RUNNING',
            "startedAt" = NOW(),
            "lastHeartbeatAt" = NOW() - INTERVAL '5 seconds',
            "updatedAt" = NOW()
        WHERE "workflowRunId" = $1
          AND "stepName" = 'step_a'`,
        [runId],
      )

      const swept = await engine.sweepTimedOutSteps()
      expect(swept).toBe(1)

      const step = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .where('stepName', '=', 'step_a')
        .executeTakeFirst()

      expect(step!.status).toBe('FAILED')
      expect(step!.error).toBe('Heartbeat timeout exceeded')
    })
  })

  // ── 3. Workflow Forking ───────────────────────────────────────────

  describe('workflow forking', () => {
    it('forks a workflow preserving completed steps and resetting rest to PENDING', async () => {
      const wf = WorkflowBuilder.create('fork-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .step('step_b', {
          executorType: 'function',
          executorConfig: { handler: 'transform' },
          dependsOn: ['step_a'],
        })
        .step('step_c', {
          executorType: 'function',
          executorConfig: { handler: 'finalize' },
          dependsOn: ['step_b'],
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'fork-test',
        tenantId: 'test-tenant',
        input: { value: 42 },
      })

      // Execute step_a
      await executeStep(engine, queuedJobs[0])
      // Execute step_b
      await executeStep(engine, queuedJobs[1])

      // Verify step_a and step_b are COMPLETED
      const stepsBeforeFork = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', runId)
        .execute()

      expect(stepsBeforeFork.find(s => s.stepName === 'step_a')!.status).toBe(
        'COMPLETED',
      )
      expect(stepsBeforeFork.find(s => s.stepName === 'step_b')!.status).toBe(
        'COMPLETED',
      )

      // Fork from step_b
      const { runId: forkedRunId } = await engine.forkWorkflow(
        runId,
        'test-tenant',
        'step_b',
      )

      expect(forkedRunId).not.toBe(runId)

      // Verify forked run
      const forkedRun = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', forkedRunId)
        .executeTakeFirst()

      expect(forkedRun!.status).toBe('RUNNING')
      expect(forkedRun!.forkedFromRunId).toBe(runId)

      // Verify forked steps
      const forkedSteps = await db
        .selectFrom('workflow_steps')
        .selectAll()
        .where('workflowRunId', '=', forkedRunId)
        .execute()

      expect(forkedSteps).toHaveLength(3)
      expect(forkedSteps.find(s => s.stepName === 'step_a')!.status).toBe(
        'COMPLETED',
      )
      expect(forkedSteps.find(s => s.stepName === 'step_b')!.status).toBe(
        'COMPLETED',
      )
      expect(forkedSteps.find(s => s.stepName === 'step_c')!.status).toBe(
        'PENDING',
      )

      // Completed steps should preserve output
      const forkedStepA = forkedSteps.find(s => s.stepName === 'step_a')!
      expect(forkedStepA.output).not.toBeNull()
    })
  })

  // ── 4. Input Validation ───────────────────────────────────────────

  describe('input validation', () => {
    it('passes when input matches schema', async () => {
      const schema = {
        parse: (input: unknown) => {
          const obj = input as Record<string, unknown>
          if (typeof obj.name !== 'string') {
            throw new Error('name must be a string')
          }
          return obj
        },
      }

      const wf = WorkflowBuilder.create('validated')
        .inputSchema(schema)
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const result = await engine.start({
        workflowName: 'validated',
        tenantId: 'test-tenant',
        input: { name: 'test' },
      })

      expect(result.runId).toBeTruthy()
    })

    it('throws InputValidationError when input fails schema', async () => {
      const schema = {
        parse: (input: unknown) => {
          const obj = input as Record<string, unknown>
          if (typeof obj.name !== 'string') {
            throw new Error('name must be a string')
          }
          return obj
        },
      }

      const wf = WorkflowBuilder.create('validated-fail')
        .inputSchema(schema)
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])

      await expect(
        engine.start({
          workflowName: 'validated-fail',
          tenantId: 'test-tenant',
          input: { name: 123 as any },
        }),
      ).rejects.toThrow(InputValidationError)
    })

    it('does not validate when no schema is set', async () => {
      const wf = WorkflowBuilder.create('no-validation')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const result = await engine.start({
        workflowName: 'no-validation',
        tenantId: 'test-tenant',
        input: { anything: 'goes' },
      })

      expect(result.runId).toBeTruthy()
    })
  })

  // ── 5. Workflow Streaming ─────────────────────────────────────────

  describe('workflow streaming', () => {
    it('writes values, reads them in order, and detects close', async () => {
      const wf = WorkflowBuilder.create('stream-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'stream-test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Write 3 values
      await engine.writeStream(runId, 'logs', 'line-1')
      await engine.writeStream(runId, 'logs', 'line-2')
      await engine.writeStream(runId, 'logs', 'line-3')

      // Read all
      const { values, closed } = await engine.readStream(runId, 'logs')
      expect(values).toEqual(['line-1', 'line-2', 'line-3'])
      expect(closed).toBe(false)

      // Close stream
      await engine.closeStream(runId, 'logs')

      // Read again — should detect close
      const result2 = await engine.readStream(runId, 'logs')
      expect(result2.values).toEqual(['line-1', 'line-2', 'line-3'])
      expect(result2.closed).toBe(true)
    })

    it('reads from a specific offset', async () => {
      const wf = WorkflowBuilder.create('stream-offset')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'stream-offset',
        tenantId: 'test-tenant',
        input: {},
      })

      await engine.writeStream(runId, 'output', 'a')
      await engine.writeStream(runId, 'output', 'b')
      await engine.writeStream(runId, 'output', 'c')

      // Read from offset 2 (skip a, b)
      const { values } = await engine.readStream(runId, 'output', 2)
      expect(values).toEqual(['c'])
    })
  })

  // ── 6. Version-Aware Dispatch ─────────────────────────────────────

  describe('version-aware dispatch', () => {
    it('stores applicationVersion and recovers only matching runs', async () => {
      const wf = WorkflowBuilder.create('versioned')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      // Create engine with v1
      const { engine: engineV1 } = createEngine([wf], {
        applicationVersion: 'v1.0.0',
      })

      // Create engine with v2
      const { engine: engineV2 } = createEngine([wf], {
        applicationVersion: 'v2.0.0',
      })

      const { runId: runV1 } = await engineV1.start({
        workflowName: 'versioned',
        tenantId: 'test-tenant',
        input: {},
      })
      const { runId: runV2 } = await engineV2.start({
        workflowName: 'versioned',
        tenantId: 'test-tenant',
        input: {},
      })

      // Verify applicationVersion is stored
      const v1Run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runV1)
        .executeTakeFirst()
      expect(v1Run!.applicationVersion).toBe('v1.0.0')

      const v2Run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runV2)
        .executeTakeFirst()
      expect(v2Run!.applicationVersion).toBe('v2.0.0')

      // Recover only v1 runs
      const recovered = await engineV1.recoverPendingWorkflows('v1.0.0')
      expect(recovered).toContain(runV1)
      expect(recovered).not.toContain(runV2)
    })
  })

  // ── 7. Delayed Workflow Execution ──────────────────────────────────

  describe('delayed workflow execution', () => {
    it('starts workflow with DELAYED status when delaySeconds is set', async () => {
      const wf = WorkflowBuilder.create('delayed')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'delayed',
        tenantId: 'test-tenant',
        input: {},
        delaySeconds: 3600, // 1 hour
      })

      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()

      expect(run!.status).toBe('DELAYED')
      expect(run!.delayUntilEpochMs).not.toBeNull()
      // Should NOT have dispatched steps
      expect(queuedJobs).toHaveLength(0)
    })

    it('processDelayedWorkflows transitions and dispatches past-due workflows', async () => {
      const wf = WorkflowBuilder.create('delayed-transition')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'delayed-transition',
        tenantId: 'test-tenant',
        input: {},
        delaySeconds: 1,
      })

      // Should not have dispatched yet
      expect(queuedJobs).toHaveLength(0)

      // Manually set the delay to the past
      await db
        .updateTable('workflow_runs')
        .set({
          delayUntilEpochMs: String(Date.now() - 1000),
          updatedAt: new Date(),
        })
        .where('id', '=', runId)
        .execute()

      const transitioned = await engine.processDelayedWorkflows()
      expect(transitioned).toBe(1)

      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()

      expect(run!.status).toBe('RUNNING')
      // Root steps should now be dispatched
      expect(queuedJobs.length).toBeGreaterThan(0)
      expect(queuedJobs[0].taskName).toBe('workflow_step_light')
    })

    it('does NOT transition workflows whose delay has not passed', async () => {
      const wf = WorkflowBuilder.create('not-yet-delayed')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine, queuedJobs } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'not-yet-delayed',
        tenantId: 'test-tenant',
        input: {},
        delaySeconds: 3600,
      })

      const transitioned = await engine.processDelayedWorkflows()
      expect(transitioned).toBe(0)
      expect(queuedJobs).toHaveLength(0)

      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()

      expect(run!.status).toBe('DELAYED')
    })

    it('idempotency deduplicates delayed workflows', async () => {
      const wf = WorkflowBuilder.create('delayed-idempotent')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const first = await engine.start({
        workflowName: 'delayed-idempotent',
        tenantId: 'test-tenant',
        input: {},
        delaySeconds: 3600,
        idempotencyKey: 'deferred:test:1',
      })

      // Second start with same key returns same run (deduplication)
      const second = await engine.start({
        workflowName: 'delayed-idempotent',
        tenantId: 'test-tenant',
        input: {},
        delaySeconds: 3600,
        idempotencyKey: 'deferred:test:1',
      })

      expect(second.runId).toBe(first.runId)

      // Only one run should exist
      const runs = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('idempotencyKey', '=', 'deferred:test:1')
        .execute()
      expect(runs).toHaveLength(1)
    })
  })

  // ── 8. Adaptive Queue Polling ─────────────────────────────────────

  describe('adaptive queue polling', () => {
    it('starts at minIntervalMs', () => {
      const poller = new AdaptivePoller({
        minIntervalMs: 100,
        maxIntervalMs: 5000,
      })
      expect(poller.getIntervalMs()).toBe(100)
    })

    it('increases interval on contention (up to max)', () => {
      const poller = new AdaptivePoller({
        minIntervalMs: 100,
        maxIntervalMs: 5000,
        backoffRate: 2.0,
      })

      poller.onContention()
      expect(poller.getIntervalMs()).toBe(200)

      poller.onContention()
      expect(poller.getIntervalMs()).toBe(400)

      // Keep doubling until we hit max
      for (let i = 0; i < 20; i++) {
        poller.onContention()
      }
      expect(poller.getIntervalMs()).toBe(5000)
    })

    it('decreases interval on success (down to min)', () => {
      const poller = new AdaptivePoller({
        minIntervalMs: 100,
        maxIntervalMs: 5000,
        backoffRate: 2.0,
        decayRate: 0.5,
      })

      // Ramp up
      poller.onContention()
      poller.onContention()
      poller.onContention()
      expect(poller.getIntervalMs()).toBe(800)

      // Decay
      poller.onSuccess()
      expect(poller.getIntervalMs()).toBe(400)

      poller.onSuccess()
      expect(poller.getIntervalMs()).toBe(200)

      poller.onSuccess()
      expect(poller.getIntervalMs()).toBe(100)

      // Should not go below min
      poller.onSuccess()
      expect(poller.getIntervalMs()).toBe(100)
    })

    it('slowly grows on idle', () => {
      const poller = new AdaptivePoller({
        minIntervalMs: 100,
        maxIntervalMs: 5000,
      })

      const before = poller.getIntervalMs()
      poller.onIdle()
      const after = poller.getIntervalMs()

      expect(after).toBeGreaterThan(before)
      expect(after).toBeLessThanOrEqual(5000)
    })

    it('stays within bounds across mixed operations', () => {
      const poller = new AdaptivePoller({
        minIntervalMs: 50,
        maxIntervalMs: 1000,
      })

      for (let i = 0; i < 100; i++) {
        const op = Math.random()
        if (op < 0.33) {
          poller.onContention()
        } else if (op < 0.66) {
          poller.onSuccess()
        } else {
          poller.onIdle()
        }

        const interval = poller.getIntervalMs()
        expect(interval).toBeGreaterThanOrEqual(50)
        expect(interval).toBeLessThanOrEqual(1000)
      }
    })
  })

  // ── 9. Queue Partitioning ─────────────────────────────────────────

  describe('queue partitioning', () => {
    it('creates tasks with partition key and fetches by key', async () => {
      const wf = WorkflowBuilder.create('partition-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'partition-test',
        tenantId: 'test-tenant',
        input: {},
      })

      // Create tasks with different partition keys
      await engine.createPartitionedTasks(runId, 'step_a', [
        { payload: { region: 'us' }, partitionKey: 'us-east' },
        { payload: { region: 'eu' }, partitionKey: 'eu-west' },
        { payload: { region: 'us2' }, partitionKey: 'us-east' },
      ])

      // Fetch with partition key filter
      const usTask = await engine.fetchNextPartitionedTask(
        runId,
        'step_a',
        'us-east',
      )
      expect(usTask).not.toBeNull()
      expect(usTask!.queuePartitionKey).toBe('us-east')

      const euTask = await engine.fetchNextPartitionedTask(
        runId,
        'step_a',
        'eu-west',
      )
      expect(euTask).not.toBeNull()
      expect(euTask!.queuePartitionKey).toBe('eu-west')
    })

    it('fetches without partition key returns any task', async () => {
      const wf = WorkflowBuilder.create('partition-any')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])
      const { runId } = await engine.start({
        workflowName: 'partition-any',
        tenantId: 'test-tenant',
        input: {},
      })

      await engine.createPartitionedTasks(runId, 'step_a', [
        { payload: { data: 1 }, partitionKey: 'key-a' },
        { payload: { data: 2 } }, // no partition key
      ])

      // Fetch without filter should return any pending task
      const task = await engine.fetchNextPartitionedTask(runId, 'step_a')
      expect(task).not.toBeNull()
    })
  })

  // ── 10. Dual-Mode GC ─────────────────────────────────────────────

  describe('dual-mode GC', () => {
    it('gc with maxRows keeps only the N newest runs', async () => {
      const wf = WorkflowBuilder.create('gc-test')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])

      // Create 10 runs and complete them
      const runIds: string[] = []
      for (let i = 0; i < 10; i++) {
        const { runId } = await engine.start({
          workflowName: 'gc-test',
          tenantId: 'test-tenant',
          input: { index: i },
        })
        runIds.push(runId)

        // Mark the run as COMPLETED
        await db
          .updateTable('workflow_runs')
          .set({
            status: 'COMPLETED',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', runId)
          .execute()
      }

      // Verify 10 runs exist
      const { rows: beforeRows } = await db.query<{ count: number }>(
        'SELECT count(*)::int as count FROM workflow_runs',
      )
      expect(beforeRows[0].count).toBe(10)

      // GC to keep only 5
      const deleted = await engine.gc({ maxRows: 5 })
      expect(deleted).toBe(5)

      // Verify 5 remain
      const { rows: afterRows } = await db.query<{ count: number }>(
        'SELECT count(*)::int as count FROM workflow_runs',
      )
      expect(afterRows[0].count).toBe(5)
    })

    it('gc with retentionDays deletes old terminal runs', async () => {
      const wf = WorkflowBuilder.create('gc-retention')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])

      // Create a run and mark as completed with old date
      const { runId } = await engine.start({
        workflowName: 'gc-retention',
        tenantId: 'test-tenant',
        input: {},
      })
      const oldDate = new Date(Date.now() - 100 * 86_400_000) // 100 days ago
      await db
        .updateTable('workflow_runs')
        .set({
          status: 'COMPLETED',
          completedAt: oldDate,
          createdAt: oldDate,
          updatedAt: oldDate,
        })
        .where('id', '=', runId)
        .execute()

      // Create a recent run
      const { runId: recentId } = await engine.start({
        workflowName: 'gc-retention',
        tenantId: 'test-tenant',
        input: {},
      })
      await db
        .updateTable('workflow_runs')
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('id', '=', recentId)
        .execute()

      const deleted = await engine.gc({ retentionDays: 30 })
      expect(deleted).toBe(1) // only the old one

      // Recent one should still exist
      const remaining = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', recentId)
        .executeTakeFirst()
      expect(remaining).toBeDefined()
    })

    it('gc preserves RUNNING runs regardless of age', async () => {
      const wf = WorkflowBuilder.create('gc-preserve')
        .step('step_a', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const { engine } = createEngine([wf])

      const { runId } = await engine.start({
        workflowName: 'gc-preserve',
        tenantId: 'test-tenant',
        input: {},
      })

      // Make it old but keep RUNNING
      const oldDate = new Date(Date.now() - 100 * 86_400_000)
      await db
        .updateTable('workflow_runs')
        .set({
          createdAt: oldDate,
          updatedAt: oldDate,
        })
        .where('id', '=', runId)
        .execute()

      const deleted = await engine.gc({ retentionDays: 1 })
      expect(deleted).toBe(0) // RUNNING is preserved

      const run = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', runId)
        .executeTakeFirst()
      expect(run).toBeDefined()
      expect(run!.status).toBe('RUNNING')
    })
  })
})

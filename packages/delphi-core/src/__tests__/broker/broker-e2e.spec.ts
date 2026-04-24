// npx vitest run src/__tests__/broker/broker-e2e.spec.ts
//
// Integration tests for the broker system — real Postgres via testcontainers.
// Tests the full agent lifecycle: token generation → registration → job dispatch
// → execution → result reporting → DB verification.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AgentRegistry } from '../../broker/AgentRegistry.js'
import { createBrokerHandlers } from '../../broker/BrokerHandlers.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from '../engine/shared.js'

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
      listen: async () => ({ stop: async () => {}, isRunning: () => false }),
    } as any,
    queuedJobs,
  }
}

describe('Broker E2E — Full Agent Lifecycle', () => {
  let db: TestDb
  let registry: AgentRegistry
  let handlers: ReturnType<typeof createBrokerHandlers>
  let fnExecutor: FunctionStepExecutor
  let _engine: WorkflowEngine

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    await db.query(`TRUNCATE TABLE agent_tokens CASCADE`)

    registry = new AgentRegistry({
      maxPendingJobs: 100,
      sweepIntervalMs: 999_999,
      agentStaleAfterMs: 5_000,
      defaultJobTimeoutMs: 30_000,
    })

    fnExecutor = new FunctionStepExecutor()
    fnExecutor.register('echo', async (p: StepPayload): Promise<StepResult> => {
      return { output: { echoed: true, step: p.stepName, input: p.input } }
    })

    const { connector } = createMockConnector()
    const wf = WorkflowBuilder.create('broker-test')
      .step('step1', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .step('step2', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
        dependsOn: ['step1'],
      })
      .build()

    _engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', fnExecutor]]),
      workflows: new Map([[wf.name, wf]]),
      tenantId: 'test-tenant',
      disableLogBuffering: true,
    })

    handlers = createBrokerHandlers({ db, registry })
  })

  // ── Token Generation + Registration ───────────────────────────

  describe('token lifecycle', () => {
    it('generates a registration token stored in DB', async () => {
      const { registrationToken, expiresAt } =
        await handlers.generateAgentToken({
          tenantId: 'test-tenant',
        })

      expect(registrationToken).toBeTruthy()
      expect(registrationToken.length).toBe(64) // 32 bytes hex
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())

      // Verify token row exists in DB
      const rows = await db.selectFrom('agent_tokens').selectAll().execute()
      expect(rows).toHaveLength(1)
      expect(rows[0].used).toBe(false)
      expect(rows[0].tenantId).toBe('test-tenant')
    })

    it('register exchanges token for agentId', async () => {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })

      const { agentId } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'my-agent',
        hostname: 'macbook.local',
        capabilities: {
          cpuCount: 8,
          memoryMB: 16384,
          dockerAvailable: true,
          gpuAvailable: false,
          queues: ['workflow_step_light', 'workflow_step_ai'],
        },
        registrationToken,
        secret: 'my-secret-123',
      })

      expect(agentId).toBeTruthy()

      // Token is now marked used
      const rows = await db.selectFrom('agent_tokens').selectAll().execute()
      expect(rows[0].used).toBe(true)
      expect(rows[0].usedBy).toBe(agentId)

      // Agent is registered in-memory
      const agent = registry.getAgent(agentId)
      expect(agent).toBeTruthy()
      expect(agent!.name).toBe('my-agent')
    })

    it('rejects reused registration token', async () => {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })

      await handlers.register({
        tenantId: 'test-tenant',
        name: 'a1',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'secret1',
      })

      await expect(
        handlers.register({
          tenantId: 'test-tenant',
          name: 'a2',
          hostname: 'h',
          capabilities: {
            cpuCount: 1,
            memoryMB: 1024,
            dockerAvailable: false,
            gpuAvailable: false,
            queues: ['workflow_step_light'],
          },
          registrationToken,
          secret: 'secret2',
        }),
      ).rejects.toThrow('already used')
    })

    it('rejects invalid registration token', async () => {
      await expect(
        handlers.register({
          tenantId: 'test-tenant',
          name: 'a',
          hostname: 'h',
          capabilities: {
            cpuCount: 1,
            memoryMB: 1024,
            dockerAvailable: false,
            gpuAvailable: false,
            queues: ['workflow_step_light'],
          },
          registrationToken: 'totally-invalid-token',
          secret: 'secret',
        }),
      ).rejects.toThrow('Invalid registration token')
    })
  })

  // ── Auth Verification ─────────────────────────────────────────

  describe('auth', () => {
    it('rejects requests with wrong secret', async () => {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'a',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'correct-secret',
      })

      await expect(
        handlers.heartbeat({ agentId, secret: 'wrong-secret' }),
      ).rejects.toThrow('Invalid agent secret')
    })

    it('rejects requests with unknown agentId', async () => {
      await expect(
        handlers.heartbeat({ agentId: 'nonexistent', secret: 'anything' }),
      ).rejects.toThrow('Unknown agent')
    })
  })

  // ── Full Job Flow ─────────────────────────────────────────────

  describe('full job flow', () => {
    async function registerAgent() {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'test-agent',
        hostname: 'h',
        capabilities: {
          cpuCount: 4,
          memoryMB: 8192,
          dockerAvailable: true,
          gpuAvailable: false,
          queues: [
            'workflow_step_light',
            'workflow_step_heavy',
            'workflow_step_ai',
            'workflow_step_sandbox',
          ],
        },
        registrationToken,
        secret: 'agent-secret',
        maxConcurrent: 5,
      })
      return agentId
    }

    it('enqueue → poll → started → result → complete', async () => {
      const agentId = await registerAgent()

      // Enqueue a job (simulating what WorkerBroker would do)
      const resultPromise = registry.enqueueJob({
        tenantId: 'test-tenant',
        type: 'step',
        queue: 'workflow_step_light',
        payload: {
          tenantId: 'test-tenant',
          stepName: 'step1',
          input: { msg: 'hello' },
        },
      })

      // Agent polls
      const { job } = await handlers.nextJob({
        agentId,
        secret: 'agent-secret',
        timeoutMs: 1_000,
      })
      expect(job).toBeTruthy()
      expect(job!.type).toBe('step')
      expect((job!.payload as any).stepName).toBe('step1')

      // Agent reports started
      await handlers.stepStarted({
        agentId,
        secret: 'agent-secret',
        jobId: job!.id,
      })

      // Agent reports result
      const { accepted } = await handlers.stepResult({
        agentId,
        secret: 'agent-secret',
        jobId: job!.id,
        result: { output: { echoed: true } },
      })
      expect(accepted).toBe(true)

      // The enqueued Promise resolves
      const result = await resultPromise
      expect(result.output).toEqual({ echoed: true })
    })

    it('idempotent result: second POST returns accepted=false', async () => {
      const agentId = await registerAgent()

      registry
        .enqueueJob({
          tenantId: 'test-tenant',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 'test-tenant' },
        })
        .catch(() => {})

      const { job } = await handlers.nextJob({
        agentId,
        secret: 'agent-secret',
        timeoutMs: 1_000,
      })

      await handlers.stepResult({
        agentId,
        secret: 'agent-secret',
        jobId: job!.id,
        result: { output: { first: true } },
      })

      // Second result for same job
      const { accepted } = await handlers.stepResult({
        agentId,
        secret: 'agent-secret',
        jobId: job!.id,
        result: { output: { second: true } },
      })
      expect(accepted).toBe(false)
    })

    it('failure flow: agent reports error', async () => {
      const agentId = await registerAgent()

      const resultPromise = registry.enqueueJob({
        tenantId: 'test-tenant',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 'test-tenant' },
      })

      const { job } = await handlers.nextJob({
        agentId,
        secret: 'agent-secret',
        timeoutMs: 1_000,
      })

      await handlers.stepFailed({
        agentId,
        secret: 'agent-secret',
        jobId: job!.id,
        error: 'executor crashed',
      })

      await expect(resultPromise).rejects.toThrow('executor crashed')
    })

    it('nextJob returns null after timeout when no jobs available', async () => {
      const agentId = await registerAgent()

      const { job } = await handlers.nextJob({
        agentId,
        secret: 'agent-secret',
        timeoutMs: 200, // Short timeout
      })
      expect(job).toBeNull()
    })
  })

  // ── Heartbeat + Sweep ─────────────────────────────────────────

  describe('heartbeat + sweep', () => {
    it('heartbeat keeps agent alive', async () => {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'a',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'sec',
      })

      const result = await handlers.heartbeat({ agentId, secret: 'sec' })
      expect(result.status).toBe('connected')
      expect(result.cancelJobIds).toEqual([])
    })

    it('stale agent: sweep rejects in-flight jobs', async () => {
      const staleRegistry = new AgentRegistry({
        maxPendingJobs: 100,
        sweepIntervalMs: 999_999,
        agentStaleAfterMs: 1,
        defaultJobTimeoutMs: 999_999,
      })
      const staleHandlers = createBrokerHandlers({
        db,
        registry: staleRegistry,
      })

      const { registrationToken } = await staleHandlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await staleHandlers.register({
        tenantId: 'test-tenant',
        name: 'a',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'sec',
      })

      const resultPromise = staleRegistry.enqueueJob({
        tenantId: 'test-tenant',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 'test-tenant' },
      })

      // Assign to agent
      staleRegistry.getNextJob(agentId)

      // Force stale
      const agent = staleRegistry.getAgent(agentId)!
      agent.lastHeartbeatAt = new Date(Date.now() - 100_000)

      staleRegistry.sweep()

      await expect(resultPromise).rejects.toThrow('stale')
    })

    it('execution timeout: sweep rejects job even with heartbeats', async () => {
      const timeoutRegistry = new AgentRegistry({
        maxPendingJobs: 100,
        sweepIntervalMs: 999_999,
        agentStaleAfterMs: 999_999,
        defaultJobTimeoutMs: 1,
      })
      const timeoutHandlers = createBrokerHandlers({
        db,
        registry: timeoutRegistry,
      })

      const { registrationToken } = await timeoutHandlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await timeoutHandlers.register({
        tenantId: 'test-tenant',
        name: 'a',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'sec',
      })

      const resultPromise = timeoutRegistry.enqueueJob({
        tenantId: 'test-tenant',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 'test-tenant' },
        timeoutMs: 1,
      })

      const job = timeoutRegistry.getNextJob(agentId)!
      timeoutRegistry.markStarted(job.id)
      job.startedAt = new Date(Date.now() - 100_000) // force timeout

      // Agent heartbeats (alive but not progressing)
      timeoutRegistry.heartbeat(agentId)

      timeoutRegistry.sweep()

      await expect(resultPromise).rejects.toThrow('Execution timeout')
    })
  })

  // ── Deregistration ────────────────────────────────────────────

  describe('deregister', () => {
    it('removes agent and rejects its jobs', async () => {
      const { registrationToken } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'a',
        hostname: 'h',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken,
        secret: 'sec',
      })

      const resultPromise = registry.enqueueJob({
        tenantId: 'test-tenant',
        type: 'step',
        queue: 'workflow_step_light',
        payload: { tenantId: 'test-tenant' },
      })

      registry.getNextJob(agentId)

      // Attach rejection handler BEFORE triggering deregister to avoid
      // unhandled promise rejection between deregister and the assertion.
      const rejection = resultPromise.catch((e: Error) => e)

      await handlers.deregister({ agentId, secret: 'sec' })

      expect(registry.getAgent(agentId)).toBeNull()
      const error = (await rejection) as Error
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('deregistered')
    })
  })

  // ── Backpressure ──────────────────────────────────────────────

  describe('backpressure', () => {
    it('rejects jobs when maxPendingJobs exceeded', async () => {
      const smallRegistry = new AgentRegistry({
        maxPendingJobs: 2,
        sweepIntervalMs: 999_999,
      })

      smallRegistry
        .enqueueJob({ tenantId: 't', type: 'step', queue: 'q', payload: {} })
        .catch(() => {})
      smallRegistry
        .enqueueJob({ tenantId: 't', type: 'step', queue: 'q', payload: {} })
        .catch(() => {})

      await expect(
        smallRegistry.enqueueJob({
          tenantId: 't',
          type: 'step',
          queue: 'q',
          payload: {},
        }),
      ).rejects.toThrow('backpressure')
    })
  })

  // ── Multiple Agents ───────────────────────────────────────────

  describe('multiple agents', () => {
    it('two agents get different jobs from the same queue', async () => {
      // Register two agents
      const { registrationToken: t1 } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId: a1 } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'agent-1',
        hostname: 'h1',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken: t1,
        secret: 'sec1',
      })

      const { registrationToken: t2 } = await handlers.generateAgentToken({
        tenantId: 'test-tenant',
      })
      const { agentId: a2 } = await handlers.register({
        tenantId: 'test-tenant',
        name: 'agent-2',
        hostname: 'h2',
        capabilities: {
          cpuCount: 1,
          memoryMB: 1024,
          dockerAvailable: false,
          gpuAvailable: false,
          queues: ['workflow_step_light'],
        },
        registrationToken: t2,
        secret: 'sec2',
      })

      // Enqueue two jobs
      registry
        .enqueueJob({
          tenantId: 'test-tenant',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 'test-tenant', idx: 0 },
        })
        .catch(() => {})
      registry
        .enqueueJob({
          tenantId: 'test-tenant',
          type: 'step',
          queue: 'workflow_step_light',
          payload: { tenantId: 'test-tenant', idx: 1 },
        })
        .catch(() => {})

      // Both agents poll
      const { job: j1 } = await handlers.nextJob({
        agentId: a1,
        secret: 'sec1',
        timeoutMs: 1_000,
      })
      const { job: j2 } = await handlers.nextJob({
        agentId: a2,
        secret: 'sec2',
        timeoutMs: 1_000,
      })

      expect(j1).toBeTruthy()
      expect(j2).toBeTruthy()
      expect(j1!.id).not.toBe(j2!.id)
    })
  })
})

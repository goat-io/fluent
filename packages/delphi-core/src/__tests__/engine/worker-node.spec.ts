// npx vitest run src/__tests__/engine/worker-node.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createWorkflowHandlers } from '../../api/WorkflowHandlers.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkerNode } from '../../worker/WorkerNode.js'
import type { WorkerCapabilities } from '../../worker/WorkerNode.types.js'
import { LocalWorkerProvisioner } from '../../worker/WorkerProvisioner.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import { getSharedDb, releaseSharedDb } from './shared.js'

// ── Unit tests (no containers) ────────────────────────────────────

describe('WorkerNode — unit', () => {
  it('detectResources() returns plausible values', () => {
    const worker = new WorkerNode()
    const caps = worker.detectResources()

    expect(caps.cpuCount).toBeGreaterThan(0)
    expect(caps.memoryMB).toBeGreaterThan(0)
    expect(typeof caps.dockerAvailable).toBe('boolean')
    expect(typeof caps.gpuAvailable).toBe('boolean')
    expect(Array.isArray(caps.queues)).toBe(true)
  })

  it('getQueueSubscriptions() always includes light and ai', () => {
    const worker = new WorkerNode({
      capabilities: { dockerAvailable: false, memoryMB: 1024 },
    })
    const subs = worker.getQueueSubscriptions({
      cpuCount: 2,
      memoryMB: 1024,
      dockerAvailable: false,
      gpuAvailable: false,
      queues: [],
    })

    const names = subs.map(s => s.taskName)
    expect(names).toContain('workflow_step_light')
    expect(names).toContain('workflow_step_ai')
    expect(names).not.toContain('workflow_step_heavy')
    expect(names).not.toContain('workflow_step_sandbox')
  })

  it('getQueueSubscriptions() includes sandbox when Docker available', () => {
    const worker = new WorkerNode()
    const subs = worker.getQueueSubscriptions({
      cpuCount: 4,
      memoryMB: 2048,
      dockerAvailable: true,
      gpuAvailable: false,
      queues: [],
    })

    const names = subs.map(s => s.taskName)
    expect(names).toContain('workflow_step_sandbox')
  })

  it('getQueueSubscriptions() includes heavy when enough memory', () => {
    const worker = new WorkerNode()
    const subs = worker.getQueueSubscriptions({
      cpuCount: 4,
      memoryMB: 8192,
      dockerAvailable: false,
      gpuAvailable: false,
      queues: [],
    })

    const names = subs.map(s => s.taskName)
    expect(names).toContain('workflow_step_heavy')
  })

  it('getQueueSubscriptions() sets correct concurrency values', () => {
    const worker = new WorkerNode()
    const subs = worker.getQueueSubscriptions({
      cpuCount: 4,
      memoryMB: 8192,
      dockerAvailable: true,
      gpuAvailable: false,
      queues: [],
    })

    const light = subs.find(s => s.taskName === 'workflow_step_light')
    expect(light?.concurrency).toBe(8) // cpuCount * 2

    const heavy = subs.find(s => s.taskName === 'workflow_step_heavy')
    expect(heavy?.concurrency).toBe(2)

    const ai = subs.find(s => s.taskName === 'workflow_step_ai')
    expect(ai?.concurrency).toBe(3)

    const sandbox = subs.find(s => s.taskName === 'workflow_step_sandbox')
    expect(sandbox?.concurrency).toBe(1)
  })

  it('WorkerNode reads from env vars', () => {
    const origRedis = process.env.AGENTS_REDIS_URL
    const origEngine = process.env.AGENTS_ENGINE_URL
    const origTenant = process.env.AGENTS_TENANT_ID
    const origName = process.env.AGENTS_WORKER_NAME
    const origToken = process.env.AGENTS_WORKER_TOKEN

    try {
      process.env.AGENTS_REDIS_URL = 'redis://test:6380'
      process.env.AGENTS_ENGINE_URL = 'http://engine:4000'
      process.env.AGENTS_TENANT_ID = 'tenant-abc'
      process.env.AGENTS_WORKER_NAME = 'test-worker'
      process.env.AGENTS_WORKER_TOKEN = 'secret-token'

      const worker = new WorkerNode()
      const info = worker.getInfo()

      expect(info.name).toBe('test-worker')
      expect(info.config.redisUrl).toBe('redis://test:6380')
      expect(info.config.engineUrl).toBe('http://engine:4000')
      expect(info.config.tenantId).toBe('tenant-abc')
    } finally {
      // Restore env
      if (origRedis !== undefined) {
        process.env.AGENTS_REDIS_URL = origRedis
      } else {
        delete process.env.AGENTS_REDIS_URL
      }
      if (origEngine !== undefined) {
        process.env.AGENTS_ENGINE_URL = origEngine
      } else {
        delete process.env.AGENTS_ENGINE_URL
      }
      if (origTenant !== undefined) {
        process.env.AGENTS_TENANT_ID = origTenant
      } else {
        delete process.env.AGENTS_TENANT_ID
      }
      if (origName !== undefined) {
        process.env.AGENTS_WORKER_NAME = origName
      } else {
        delete process.env.AGENTS_WORKER_NAME
      }
      if (origToken !== undefined) {
        process.env.AGENTS_WORKER_TOKEN = origToken
      } else {
        delete process.env.AGENTS_WORKER_TOKEN
      }
    }
  })

  it('WorkerNode config overrides env vars', () => {
    process.env.AGENTS_REDIS_URL = 'redis://env:6379'
    try {
      const worker = new WorkerNode({
        redisUrl: 'redis://config:6379',
        name: 'override-name',
      })
      const info = worker.getInfo()
      expect(info.config.redisUrl).toBe('redis://config:6379')
      expect(info.name).toBe('override-name')
    } finally {
      delete process.env.AGENTS_REDIS_URL
    }
  })

  it('detectResources() applies capability overrides', () => {
    const worker = new WorkerNode({
      capabilities: {
        cpuCount: 64,
        memoryMB: 131072,
        dockerAvailable: true,
        gpuAvailable: true,
      },
    })
    const caps = worker.detectResources()

    expect(caps.cpuCount).toBe(64)
    expect(caps.memoryMB).toBe(131072)
    expect(caps.dockerAvailable).toBe(true)
    expect(caps.gpuAvailable).toBe(true)
  })

  it('getRecommendedConcurrency() scales up for high queue depth (>100)', async () => {
    const worker = new WorkerNode({
      capabilities: { cpuCount: 4, memoryMB: 8192, dockerAvailable: false },
    })

    const result = await worker.getRecommendedConcurrency(async () => 150)
    const light = result.find(r => r.taskName === 'workflow_step_light')
    // Base concurrency is cpuCount*2=8, scaled *3 = 24, capped at 50
    expect(light!.concurrency).toBe(24)

    const ai = result.find(r => r.taskName === 'workflow_step_ai')
    // Base concurrency is 3, scaled *3 = 9, capped at 50
    expect(ai!.concurrency).toBe(9)
  })

  it('getRecommendedConcurrency() scales down for empty queue (0)', async () => {
    const worker = new WorkerNode({
      capabilities: { cpuCount: 4, memoryMB: 8192, dockerAvailable: false },
    })

    const result = await worker.getRecommendedConcurrency(async () => 0)
    const light = result.find(r => r.taskName === 'workflow_step_light')
    // Base concurrency is 8, floor(8/2) = 4, min 1
    expect(light!.concurrency).toBe(4)

    const ai = result.find(r => r.taskName === 'workflow_step_ai')
    // Base concurrency is 3, floor(3/2) = 1, min 1
    expect(ai!.concurrency).toBe(1)
  })

  it('getRecommendedConcurrency() doubles for moderate depth (20-100)', async () => {
    const worker = new WorkerNode({
      capabilities: { cpuCount: 4, memoryMB: 8192, dockerAvailable: false },
    })

    const result = await worker.getRecommendedConcurrency(async () => 50)
    const light = result.find(r => r.taskName === 'workflow_step_light')
    // Base concurrency is 8, doubled = 16, capped at 30
    expect(light!.concurrency).toBe(16)

    const ai = result.find(r => r.taskName === 'workflow_step_ai')
    // Base concurrency is 3, doubled = 6, capped at 30
    expect(ai!.concurrency).toBe(6)
  })

  it('start() and stop() manage status', async () => {
    const worker = new WorkerNode({ heartbeatIntervalMs: 60_000 })
    const info1 = worker.getInfo()
    expect(info1.status).toBe('idle')

    await worker.start(null as any, null as any)
    const info2 = worker.getInfo()
    expect(info2.status).toBe('active')

    await worker.stop()
    const info3 = worker.getInfo()
    expect(info3.status).toBe('offline')
  })
})

// ── LocalWorkerProvisioner ────────────────────────────────────────

describe('LocalWorkerProvisioner', () => {
  it('provision, list, heartbeat, deprovision roundtrip', async () => {
    const prov = new LocalWorkerProvisioner()

    const caps: WorkerCapabilities = {
      cpuCount: 4,
      memoryMB: 8192,
      dockerAvailable: true,
      gpuAvailable: false,
      queues: ['workflow_step_light', 'workflow_step_ai'],
    }

    // Provision
    const reg = await prov.provision('worker-1', 'tenant-x', caps)
    expect(reg.id).toBeTruthy()
    expect(reg.name).toBe('worker-1')
    expect(reg.status).toBe('active')

    // List
    const list = await prov.listWorkers('tenant-x')
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(reg.id)

    // Heartbeat
    const oldBeat = reg.lastHeartbeatAt
    await new Promise(r => setTimeout(r, 10))
    await prov.heartbeat(reg.id)
    const list2 = await prov.listWorkers('tenant-x')
    expect(list2[0].lastHeartbeatAt).not.toBe(oldBeat)

    // Deprovision
    await prov.deprovision(reg.id)
    const list3 = await prov.listWorkers('tenant-x')
    expect(list3[0].status).toBe('offline')
  })
})

// ── Integration: Worker registration via handlers (needs testcontainers) ──

describe('Worker registration roundtrip (DB)', () => {
  let db: TestDb
  let engine: WorkflowEngine

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

  beforeAll(async () => {
    db = await getSharedDb()
    const { connector } = createMockConnector()
    const wf = WorkflowBuilder.create('test-wf')
      .version('1.0.0')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()
    const fnExecutor = new FunctionStepExecutor()
    fnExecutor.register('echo', async () => ({ output: {} }))
    engine = new WorkflowEngine({
      db,
      connector,
      workflows: new Map([['test-wf', wf]]),
      executors: new Map([['function', fnExecutor]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    // Clean worker_nodes table
    try {
      await db.query(`DELETE FROM worker_nodes`)
    } catch {
      // Table might not exist yet on first run — ignore
    }
  })

  it('register, heartbeat, list, deregister', async () => {
    const handlers = createWorkflowHandlers(engine)

    // Register
    const { workerId } = await handlers.registerWorker({
      tenantId: 'test-tenant',
      name: 'worker-alpha',
      hostname: 'host-1.local',
      capabilities: { cpuCount: 8, memoryMB: 16384, dockerAvailable: true },
    })
    expect(workerId).toBeTruthy()

    // List — should see 1 active worker
    const list1 = await handlers.listWorkers({ tenantId: 'test-tenant' })
    expect(list1.length).toBe(1)
    expect(list1[0].name).toBe('worker-alpha')
    expect(list1[0].status).toBe('active')

    // Heartbeat
    const { success } = await handlers.workerHeartbeat({ workerId })
    expect(success).toBe(true)

    // Deregister
    await handlers.deregisterWorker({ workerId })

    // List — should be empty (offline workers filtered out)
    const list2 = await handlers.listWorkers({ tenantId: 'test-tenant' })
    expect(list2.length).toBe(0)
  })
})

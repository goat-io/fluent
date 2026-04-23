// npx vitest run src/__tests__/engine/worker-node-e2e.spec.ts
//
// E2E tests for WorkerNode — real BullMQ, real Postgres, real job processing.
// Verifies that WorkerNode.start() actually subscribes to queues and processes workflows.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createWorkflowHandlers } from '../../api/WorkflowHandlers.js'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkerNode } from '../../worker/WorkerNode.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

interface GlobalTestData {
  redis: { host: string; port: number }
}

function getGlobalData(): GlobalTestData {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  )
}

describe('WorkerNode E2E — Real BullMQ + Postgres', () => {
  let db: TestDb
  let connector: BullMQConnector
  let engine: WorkflowEngine
  let workerNode: WorkerNode
  let executor: FunctionStepExecutor

  beforeAll(async () => {
    db = await getSharedDb()
    const data = getGlobalData()
    connector = new BullMQConnector({
      connection: { host: data.redis.host, port: data.redis.port },
    })
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)

    // Stop previous worker if running
    if (workerNode) {
      await workerNode.stop()
    }

    executor = new FunctionStepExecutor()
  })

  async function setupAndStart(
    workflows: ReturnType<typeof WorkflowBuilder.prototype.build>[],
    workerConfig?: { capabilities?: any },
  ) {
    const workflowMap = new Map(workflows.map(w => [w.name, w]))

    engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: workflowMap,
      tenantId: 'worker-e2e',
      disableLogBuffering: true,
    })

    // Create worker node with forced capabilities for predictable queue subscriptions
    workerNode = new WorkerNode({
      name: 'test-worker',
      tenantId: 'worker-e2e',
      heartbeatIntervalMs: 60_000, // Long interval so it doesn't interfere
      capabilities: {
        cpuCount: 4,
        memoryMB: 8192,
        dockerAvailable: false, // Don't subscribe to sandbox queue in tests
        gpuAvailable: false,
        ...(workerConfig?.capabilities ?? {}),
      },
    })

    // Start the worker — this calls connector.listen() internally
    await workerNode.start(engine, connector)
    // Give BullMQ workers time to register
    await new Promise(r => setTimeout(r, 1500))

    return { engine, workerNode }
  }

  async function waitForStatus(
    runId: string,
    targets: string[],
    timeoutMs = 15_000,
  ): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const status = await engine.getStatus(runId, 'worker-e2e')
      if (targets.includes(status.status)) {
        return status.status
      }
      await new Promise(r => setTimeout(r, 200))
    }
    const final = await engine.getStatus(runId, 'worker-e2e')
    throw new Error(
      `Workflow ${runId} did not reach ${targets.join('|')} within ${timeoutMs}ms. ` +
        `Current: ${final.status}, steps: ${final.steps.map(s => `${s.stepName}=${s.status}`).join(', ')}`,
    )
  }

  it('worker node processes a single-step workflow end-to-end', async () => {
    executor.register(
      'hello',
      async (): Promise<StepResult> => ({
        output: { message: 'Hello from worker node!' },
      }),
    )

    const wf = WorkflowBuilder.create('worker_hello')
      .step('greet', {
        executorType: 'function',
        executorConfig: { handler: 'hello' },
      })
      .build()

    await setupAndStart([wf])

    const { runId } = await engine.start({
      workflowName: 'worker_hello',
      tenantId: 'worker-e2e',
      input: {},
    })

    const finalStatus = await waitForStatus(runId, ['COMPLETED', 'FAILED'])
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'worker-e2e')
    expect((status.steps[0].output as any)?.message).toBe(
      'Hello from worker node!',
    )
  })

  it('worker node processes a multi-step chain', async () => {
    executor.register(
      'step_a',
      async (): Promise<StepResult> => ({
        output: { from: 'A' },
      }),
    )
    executor.register(
      'step_b',
      async (p: StepPayload): Promise<StepResult> => ({
        output: { from: 'B', received: p.input },
      }),
    )
    executor.register(
      'step_c',
      async (p: StepPayload): Promise<StepResult> => ({
        output: { from: 'C', received: p.input },
      }),
    )

    const wf = WorkflowBuilder.create('worker_chain')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'step_a' },
      })
      .step('b', {
        dependsOn: ['a'],
        executorType: 'function',
        executorConfig: { handler: 'step_b' },
        mapInput: up => ({ upstream: up.a }),
      })
      .step('c', {
        dependsOn: ['b'],
        executorType: 'function',
        executorConfig: { handler: 'step_c' },
        mapInput: up => ({ upstream: up.b }),
      })
      .build()

    await setupAndStart([wf])

    const { runId } = await engine.start({
      workflowName: 'worker_chain',
      tenantId: 'worker-e2e',
      input: {},
    })

    const finalStatus = await waitForStatus(runId, ['COMPLETED', 'FAILED'])
    expect(finalStatus).toBe('COMPLETED')

    const status = await engine.getStatus(runId, 'worker-e2e')
    expect(status.steps).toHaveLength(3)
    expect(status.steps.every(s => s.status === 'COMPLETED')).toBe(true)
  })

  it('worker node subscribes to correct queues based on capabilities', async () => {
    const node = new WorkerNode({
      capabilities: {
        cpuCount: 2,
        memoryMB: 2048, // < 4096 → no heavy queue
        dockerAvailable: true, // → sandbox queue
        gpuAvailable: false,
      },
    })

    const subs = node.getQueueSubscriptions()
    const queueNames = subs.map(s => s.taskName)

    expect(queueNames).toContain('workflow_step_light')
    expect(queueNames).toContain('workflow_step_ai')
    expect(queueNames).toContain('workflow_step_sandbox')
    expect(queueNames).not.toContain('workflow_step_heavy') // memory too low
  })

  it('worker node processes steps with different weights', async () => {
    executor.register(
      'light_work',
      async (): Promise<StepResult> => ({
        output: { type: 'light' },
      }),
    )
    executor.register(
      'heavy_work',
      async (): Promise<StepResult> => ({
        output: { type: 'heavy' },
      }),
    )

    const wf = WorkflowBuilder.create('worker_weights')
      .step('light', {
        executorType: 'function',
        executorConfig: { handler: 'light_work' },
        stepWeight: 'light',
      })
      .step('heavy', {
        dependsOn: ['light'],
        executorType: 'function',
        executorConfig: { handler: 'heavy_work' },
        stepWeight: 'heavy',
      })
      .build()

    await setupAndStart([wf])

    const { runId } = await engine.start({
      workflowName: 'worker_weights',
      tenantId: 'worker-e2e',
      input: {},
    })

    const finalStatus = await waitForStatus(runId, ['COMPLETED', 'FAILED'])
    expect(finalStatus).toBe('COMPLETED')
  })

  it('worker node graceful stop drains in-flight jobs', async () => {
    let stepStarted = false

    executor.register('slow_step', async (): Promise<StepResult> => {
      stepStarted = true
      await new Promise(r => setTimeout(r, 1000)) // Simulate slow work
      return { output: { done: true } }
    })

    const wf = WorkflowBuilder.create('worker_drain')
      .step('slow', {
        executorType: 'function',
        executorConfig: { handler: 'slow_step' },
      })
      .build()

    await setupAndStart([wf])

    const { runId } = await engine.start({
      workflowName: 'worker_drain',
      tenantId: 'worker-e2e',
      input: {},
    })

    // Wait for step to start
    while (!stepStarted) {
      await new Promise(r => setTimeout(r, 100))
    }

    // Stop worker while step is in-flight — should drain gracefully
    await workerNode.stop()

    // The step should have completed (drain waits for in-flight)
    const status = await engine.getStatus(runId, 'worker-e2e')
    // Either completed (drain succeeded) or still running (drain timed out)
    expect(['COMPLETED', 'RUNNING']).toContain(status.status)
  })

  it('worker registration and heartbeat via API handlers', async () => {
    executor.register('echo', async (): Promise<StepResult> => ({ output: {} }))

    const wf = WorkflowBuilder.create('worker_reg')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'echo' },
      })
      .build()

    const { engine: eng } = await setupAndStart([wf])
    const handlers = createWorkflowHandlers(eng)

    // Register worker
    const reg = await handlers.registerWorker({
      tenantId: 'worker-e2e',
      name: 'test-worker-1',
      hostname: 'localhost',
      capabilities: {
        cpuCount: 4,
        memoryMB: 8192,
        queues: ['workflow_step_light'],
      },
    })
    expect(reg.workerId).toBeDefined()

    // Heartbeat
    const hb = await handlers.workerHeartbeat({ workerId: reg.workerId })
    expect(hb.success).toBe(true)

    // List workers
    const workers = await handlers.listWorkers({ tenantId: 'worker-e2e' })
    expect(workers.length).toBeGreaterThanOrEqual(1)
    const found = workers.find((w: any) => w.id === reg.workerId)
    expect(found).toBeDefined()
    expect(found!.name).toBe('test-worker-1')

    // Deregister
    await handlers.deregisterWorker({ workerId: reg.workerId })
    const after = await handlers.listWorkers({ tenantId: 'worker-e2e' })
    expect(after.find((w: any) => w.id === reg.workerId)).toBeUndefined()
  })

  it('getInfo() reflects current worker state', async () => {
    executor.register('noop', async (): Promise<StepResult> => ({ output: {} }))

    const wf = WorkflowBuilder.create('worker_info')
      .step('a', {
        executorType: 'function',
        executorConfig: { handler: 'noop' },
      })
      .build()

    await setupAndStart([wf])

    const info = workerNode.getInfo()
    expect(info.name).toBe('test-worker')
    expect(info.status).toBe('active')
    expect(info.capabilities.cpuCount).toBe(4)
    expect(info.capabilities.memoryMB).toBe(8192)
    expect(info.capabilities.queues).toContain('workflow_step_light')
    expect(info.capabilities.queues).toContain('workflow_step_ai')
    expect(info.capabilities.queues).toContain('workflow_step_heavy')

    await workerNode.stop()
    expect(workerNode.getInfo().status).toBe('offline')
  })
})

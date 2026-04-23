// npx vitest run src/__tests__/engine/worker-specialization.spec.ts
//
// Tests for Issue #1: Worker specialization — light/heavy queue routing
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BullMQConnector } from '@goatlab/tasks-adapter-bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowStepTask } from '../../tasks/WorkflowStepTask.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('Worker Specialization — Light/Heavy Queue Routing', () => {
  let db: TestDb
  let connector: BullMQConnector

  beforeAll(async () => {
    db = await getSharedDb()
    const tempData = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
    )
    connector = new BullMQConnector({
      connection: { host: tempData.redis.host, port: tempData.redis.port },
    })
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
  })

  it('routes light steps to workflow_step_light queue', async () => {
    const queuedTo: string[] = []
    const trackingConnector = {
      ...connector,
      queue: async (params: any) => {
        queuedTo.push(params.taskName)
        return connector.queue(params)
      },
    }

    const executor = new FunctionStepExecutor()
    executor.register('fast_compute', async () => ({
      output: { result: 'done' },
    }))

    const workflow = WorkflowBuilder.create('light_test')
      .version('1.0.0')
      .step('fast_step', {
        executorType: 'function',
        executorConfig: { handler: 'fast_compute' },
        stepWeight: 'light',
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector: trackingConnector as any,
      executors: new Map([['function', executor]]),
      workflows: new Map([['light_test', workflow]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })

    await engine.start({
      workflowName: 'light_test',
      tenantId: 'test',
      input: {},
    })

    expect(queuedTo).toContain('workflow_step_light')
    expect(queuedTo).not.toContain('workflow_step_heavy')
    await engine.shutdown()
  })

  it('routes heavy steps to workflow_step_heavy queue', async () => {
    const queuedTo: string[] = []
    const trackingConnector = {
      ...connector,
      queue: async (params: any) => {
        queuedTo.push(params.taskName)
        return connector.queue(params)
      },
    }

    const executor = new FunctionStepExecutor()
    executor.register('docker_compute', async () => ({
      output: { result: 'done' },
    }))

    const workflow = WorkflowBuilder.create('heavy_test')
      .version('1.0.0')
      .step('docker_step', {
        executorType: 'function',
        executorConfig: { handler: 'docker_compute' },
        stepWeight: 'heavy',
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector: trackingConnector as any,
      executors: new Map([['function', executor]]),
      workflows: new Map([['heavy_test', workflow]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })

    await engine.start({
      workflowName: 'heavy_test',
      tenantId: 'test',
      input: {},
    })

    expect(queuedTo).toContain('workflow_step_heavy')
    expect(queuedTo).not.toContain('workflow_step_light')
    await engine.shutdown()
  })

  it('defaults unspecified weight to light queue', async () => {
    const queuedTo: string[] = []
    const trackingConnector = {
      ...connector,
      queue: async (params: any) => {
        queuedTo.push(params.taskName)
        return connector.queue(params)
      },
    }

    const executor = new FunctionStepExecutor()
    executor.register('default_step', async () => ({
      output: { result: 'done' },
    }))

    const workflow = WorkflowBuilder.create('default_test')
      .version('1.0.0')
      .step('no_weight', {
        executorType: 'function',
        executorConfig: { handler: 'default_step' },
        // No stepWeight specified
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector: trackingConnector as any,
      executors: new Map([['function', executor]]),
      workflows: new Map([['default_test', workflow]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })

    await engine.start({
      workflowName: 'default_test',
      tenantId: 'test',
      input: {},
    })

    expect(queuedTo).toContain('workflow_step_light')
    await engine.shutdown()
  })

  it('mixed workflow routes each step to correct queue', async () => {
    const queuedTo: string[] = []
    const trackingConnector = {
      ...connector,
      queue: async (params: any) => {
        queuedTo.push(params.taskName)
        return connector.queue(params)
      },
    }

    const executor = new FunctionStepExecutor()
    executor.register('plan', async () => ({ output: { tasks: ['a'] } }))
    executor.register('implement', async () => ({ output: { code: true } }))

    const workflow = WorkflowBuilder.create('mixed_test')
      .version('1.0.0')
      .step('plan', {
        executorType: 'function',
        executorConfig: { handler: 'plan' },
        stepWeight: 'light',
      })
      .step('implement', {
        dependsOn: ['plan'],
        executorType: 'function',
        executorConfig: { handler: 'implement' },
        stepWeight: 'heavy',
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector: trackingConnector as any,
      executors: new Map([['function', executor]]),
      workflows: new Map([['mixed_test', workflow]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })

    await engine.start({
      workflowName: 'mixed_test',
      tenantId: 'test',
      input: {},
    })

    // First step should be light
    expect(queuedTo[0]).toBe('workflow_step_light')
    await engine.shutdown()
  })

  it('completes full workflow through separate light/heavy workers', async () => {
    const executor = new FunctionStepExecutor()
    executor.register('fast', async () => ({ output: { speed: 'fast' } }))
    executor.register('slow', async () => ({ output: { speed: 'slow' } }))

    const workflow = WorkflowBuilder.create('dual_worker')
      .version('1.0.0')
      .step('light_step', {
        executorType: 'function',
        executorConfig: { handler: 'fast' },
        stepWeight: 'light',
      })
      .step('heavy_step', {
        dependsOn: ['light_step'],
        executorType: 'function',
        executorConfig: { handler: 'slow' },
        stepWeight: 'heavy',
      })
      .build()

    const engine = new WorkflowEngine({
      db,
      connector,
      executors: new Map([['function', executor]]),
      workflows: new Map([['dual_worker', workflow]]),
      tenantId: 'test',
      disableLogBuffering: true,
    })

    const stepTask = new WorkflowStepTask(engine)
    ;(stepTask as any).connector = connector

    // Start separate workers for each queue
    const lightWorker = await connector.listen({
      tasks: [
        {
          taskName: 'workflow_step_light',
          handle: (data: unknown) => stepTask.handle(data as any),
          concurrency: 10,
        },
      ],
    })

    const heavyWorker = await connector.listen({
      tasks: [
        {
          taskName: 'workflow_step_heavy',
          handle: (data: unknown) => stepTask.handle(data as any),
          concurrency: 2,
        },
      ],
    })

    const { runId } = await engine.start({
      workflowName: 'dual_worker',
      tenantId: 'test',
      input: {},
    })

    // Wait for completion
    const maxWait = 15_000
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const status = await engine.getStatus(runId, 'test')
      if (status.status === 'COMPLETED') {
        break
      }
      await new Promise(r => setTimeout(r, 200))
    }

    const final = await engine.getStatus(runId, 'test')
    expect(final.status).toBe('COMPLETED')
    expect(final.steps).toHaveLength(2)

    await lightWorker.stop()
    await heavyWorker.stop()
    await engine.shutdown()
  })
})

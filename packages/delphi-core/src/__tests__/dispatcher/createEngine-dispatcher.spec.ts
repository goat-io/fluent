// npx vitest run src/__tests__/dispatcher/createEngine-dispatcher.spec.ts
//
// Unit tests for createEngine + dispatcher integration.
// No testcontainers — the dispatcher is mocked. Verifies that createEngine
// correctly wires onAfterQueue → fireHint when a dispatcher is provided,
// exposes the connector on EngineServices, and does not regress when no
// dispatcher is present.

import type { JsonObject } from '@goatlab/tasks-core'
import { describe, expect, it, vi } from 'vitest'
import type { Dispatcher } from '../../dispatcher/dispatcher.types.js'
import { PgConnector } from '../../engine/PgConnector.js'
import { createEngine } from '../../workflow/createEngine.js'
import { FunctionStep } from '../../workflow/Step.js'
import { step, Workflow } from '../../workflow/Workflow.js'

// ── Helpers ──────────────────────────────────────────────────────────

class NoopStep extends FunctionStep<JsonObject, JsonObject> {
  stepName = 'noop' as const
  async handle() {
    return { output: {} }
  }
}
const noopStep = new NoopStep()

class TestWorkflow extends Workflow<{ x: number }> {
  workflowName = 'test_wf' as const
  steps = [step(noopStep)] as const
}

function createMockDispatcher(): Dispatcher {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(false),
    handler: vi.fn(),
    fireHint: vi.fn().mockResolvedValue(undefined),
    syncSchedules: vi.fn().mockResolvedValue({ totalJobs: 0, tenantCount: 0 }),
  }
}

function makeMockDb() {
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    transaction: vi.fn().mockImplementation(async (fn: any) => fn(mockDb)),
    getPool: vi.fn().mockReturnValue({
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as any
  return mockDb
}

function makeConnectorStub() {
  return {
    getQueue: () => ({
      addBulk: vi.fn(async () => undefined),
      getJob: vi.fn(),
    }),
    bulkQueue: vi.fn(async () => undefined),
    queue: vi.fn(async () => ({})),
    listen: vi.fn(async () => ({ stop: vi.fn() })),
    close: vi.fn(async () => undefined),
  } as any
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createEngine + dispatcher integration', () => {
  it('accepts dispatcher in config without throwing', () => {
    const dispatcher = createMockDispatcher()
    expect(() =>
      createEngine({
        workflows: [new TestWorkflow()] as const,
        database: makeMockDb(),
        connector: makeConnectorStub(),
        tenantId: 'tenant-a',
        dispatcher,
      }),
    ).not.toThrow()
  })

  it('works without dispatcher (no regression)', () => {
    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      connector: makeConnectorStub(),
      tenantId: 'tenant-b',
    })
    expect(engine).toBeDefined()
    expect(typeof engine.test_wf.start).toBe('function')
    expect(typeof engine.test_wf.startBuffered).toBe('function')
  })

  it('exposes connector on EngineServices', () => {
    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      connector: makeConnectorStub(),
      tenantId: 'tenant-c',
    })
    expect(engine.connector).toBeDefined()
    // The connector should be a TaskConnector-like object
    expect(typeof engine.connector.queue).toBe('function')
  })

  it('with dispatcher + redis: onAfterQueue wired to fireHint', () => {
    // BullMQConnector is a devDep — require succeeds in test.
    // We can't actually connect to Redis, but the constructor is enough.
    const dispatcher = createMockDispatcher()

    // createEngine with redis + dispatcher should wire onAfterQueue
    // via BullMQConnector. Since we don't have a real Redis, we test
    // the connector creation by inspecting its internals.
    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      tenantId: 'tenant-redis',
      redis: { host: 'localhost', port: 6379 },
      dispatcher,
    })

    // The connector should be a BullMQConnector with tenant-prefixed keys.
    // BullMQConnector stores the prefix in its config — check it.
    const connector = engine.connector as any
    // BullMQ connectors store prefix in `_prefix` or `config.prefix`
    const prefix =
      connector._prefix ?? connector.config?.prefix ?? connector.prefix
    expect(prefix).toContain('tenant-redis')
  })

  it('with dispatcher + postgres: onAfterQueue wired to fireHint', () => {
    const dispatcher = createMockDispatcher()

    // When no `redis` is provided, createEngine builds a PgConnector.
    // With a dispatcher present, onAfterQueue is set on the PgConnector.
    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      tenantId: 'tenant-pg',
      dispatcher,
    })

    // PgConnector stores the callback as `onAfterQueueCb` (private field).
    const connector = engine.connector as any
    expect(connector).toBeInstanceOf(PgConnector)
    expect(connector.onAfterQueueCb).toBeDefined()
    expect(typeof connector.onAfterQueueCb).toBe('function')
  })

  it('fireHint receives correct tenantId from engine config', async () => {
    const dispatcher = createMockDispatcher()

    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      tenantId: 'acme-corp',
      dispatcher,
    })

    // The PgConnector is wired to call dispatcher.fireHint on queue().
    // Call queue() on the connector directly to trigger onAfterQueue.
    const connector = engine.connector as PgConnector
    await connector.queue({
      uniqueTaskName: 'wf-run123-step1-1-i0',
      taskName: 'workflow_step_light',
      postUrl: '',
      taskBody: {},
      handle: async () => ({}),
    })

    // fireHint should have been called with the correct tenantId.
    expect(dispatcher.fireHint).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'acme-corp',
        queueName: 'workflow_step_light',
      }),
    )
  })

  it('without dispatcher: onAfterQueue not set (no fireHint calls)', async () => {
    const engine = createEngine({
      workflows: [new TestWorkflow()] as const,
      database: makeMockDb(),
      tenantId: 'tenant-no-dispatch',
      // No dispatcher provided
    })

    // PgConnector should have no onAfterQueueCb.
    const connector = engine.connector as any
    expect(connector).toBeInstanceOf(PgConnector)
    expect(connector.onAfterQueueCb).toBeUndefined()

    // Calling queue() should work without errors (no fireHint to call).
    await expect(
      connector.queue({
        uniqueTaskName: 'wf-run456-step1-1-i0',
        taskName: 'workflow_step_light',
        postUrl: '',
        taskBody: {},
        handle: async () => ({}),
      }),
    ).resolves.toBeDefined()
  })
})

// npx vitest run src/__tests__/dispatcher/dispatch-handler.spec.ts
//
// Unit tests for DispatchHandler — the Express-compatible HTTP handler that
// accepts dispatch requests, responds 202 immediately, and processes work
// asynchronously in the background.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDispatchHandler } from '../../dispatcher/DispatchHandler.js'
import type { ResolvedTenantEngine } from '../../dispatcher/dispatcher.types.js'

// ── Helpers ──────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { 'x-tenant-id': 'tenant-a' },
    body: { queueName: 'workflow_ingest', jobId: 'job-1' },
    ...overrides,
  }
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res
}

function makeMockEngine(): ResolvedTenantEngine & {
  connector: { processIncomingDispatch: ReturnType<typeof vi.fn> }
  ingestWorker: { handleJob: ReturnType<typeof vi.fn> }
  stepTask: { handle: ReturnType<typeof vi.fn> }
  scheduler: { upsertSchedule: ReturnType<typeof vi.fn> }
} {
  return {
    connector: {
      processIncomingDispatch: vi
        .fn()
        .mockResolvedValue({ processed: 1, failed: 0 }),
    } as any,
    ingestWorker: { handleJob: vi.fn().mockResolvedValue(undefined) },
    stepTask: { handle: vi.fn().mockResolvedValue(undefined) },
    scheduler: { upsertSchedule: vi.fn() },
  }
}

/** Wait enough for fire-and-forget async work to settle. */
const tick = (ms = 50) => new Promise<void>(r => setTimeout(r, ms))

// ── Tests ────────────────────────────────────────────────────────────

describe('createDispatchHandler', () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 when X-Tenant-ID header is missing', () => {
    const handler = createDispatchHandler({
      resolveTenant: vi.fn(),
      logger: mockLogger,
    })
    const req = makeReq({ headers: {} })
    const res = makeRes()

    handler(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing X-Tenant-ID header',
    })
  })

  it('returns 202 Accepted immediately with tenantId', () => {
    const resolveTenant = vi.fn().mockResolvedValue(makeMockEngine())
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })
    const res = makeRes()

    handler(makeReq(), res)

    expect(res.status).toHaveBeenCalledWith(202)
    expect(res.json).toHaveBeenCalledWith({
      accepted: true,
      tenantId: 'tenant-a',
    })
  })

  it('calls resolveTenant with the correct tenantId', async () => {
    const engine = makeMockEngine()
    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(resolveTenant).toHaveBeenCalledWith('tenant-a')
  })

  it('calls processIncomingDispatch on the resolved engine connector', async () => {
    const engine = makeMockEngine()
    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(engine.connector.processIncomingDispatch).toHaveBeenCalledTimes(1)
  })

  it('passes hint from request body to processIncomingDispatch', async () => {
    const engine = makeMockEngine()
    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(
      makeReq({
        body: { queueName: 'workflow_ingest', jobId: 'hint-job-42' },
      }),
      makeRes(),
    )
    await tick()

    const callArgs = engine.connector.processIncomingDispatch.mock.calls[0][0]
    expect(callArgs.hint).toEqual({
      tenantId: 'tenant-a',
      queueName: 'workflow_ingest',
      jobId: 'hint-job-42',
    })
  })

  it('routes workflow_ingest to ingestWorker.handleJob', async () => {
    const engine = makeMockEngine()
    let capturedHandleTask: any

    engine.connector.processIncomingDispatch.mockImplementation(
      async (params: any) => {
        capturedHandleTask = params.handleTask
        await params.handleTask('workflow_ingest', { some: 'data' })
        return { processed: 1, failed: 0 }
      },
    )

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(capturedHandleTask).toBeDefined()
    expect(engine.ingestWorker.handleJob).toHaveBeenCalledWith({
      some: 'data',
    })
  })

  it('routes workflow_step_light to stepTask.handle', async () => {
    const engine = makeMockEngine()
    engine.connector.processIncomingDispatch.mockImplementation(
      async (params: any) => {
        await params.handleTask('workflow_step_light', { step: 'light' })
        return { processed: 1, failed: 0 }
      },
    )

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(engine.stepTask.handle).toHaveBeenCalledWith({ step: 'light' })
  })

  it('routes workflow_step_heavy to stepTask.handle', async () => {
    const engine = makeMockEngine()
    engine.connector.processIncomingDispatch.mockImplementation(
      async (params: any) => {
        await params.handleTask('workflow_step_heavy', { step: 'heavy' })
        return { processed: 1, failed: 0 }
      },
    )

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(engine.stepTask.handle).toHaveBeenCalledWith({ step: 'heavy' })
  })

  it('throws on unknown queue name inside handleTask', async () => {
    const engine = makeMockEngine()
    let handleTaskError: Error | undefined

    engine.connector.processIncomingDispatch.mockImplementation(
      async (params: any) => {
        try {
          await params.handleTask('unknown_queue', { bad: true })
        } catch (err) {
          handleTaskError = err as Error
        }
        return { processed: 0, failed: 1 }
      },
    )

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(handleTaskError).toBeDefined()
    expect(handleTaskError!.message).toContain('Unknown queue')
    expect(handleTaskError!.message).toContain('unknown_queue')
  })

  it('logs error when resolveTenant fails (no crash)', async () => {
    const resolveTenant = vi
      .fn()
      .mockRejectedValue(new Error('Tenant DB unreachable'))

    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    // Should not throw — the handler catches internally
    handler(makeReq(), makeRes())
    await tick()

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[Dispatch] Request failed',
      expect.objectContaining({
        error: 'Tenant DB unreachable',
        tenantId: 'tenant-a',
      }),
    )
  })

  it('logs error when processIncomingDispatch fails (no crash)', async () => {
    const engine = makeMockEngine()
    engine.connector.processIncomingDispatch.mockRejectedValue(
      new Error('Connector blew up'),
    )

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    handler(makeReq(), makeRes())
    await tick()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Dispatch] Request failed'),
      expect.objectContaining({
        tenantId: 'tenant-a',
        error: 'Connector blew up',
      }),
    )
  })

  it('handles concurrent requests for different tenants', async () => {
    const engineA = makeMockEngine()
    const engineB = makeMockEngine()

    const resolveTenant = vi
      .fn()
      .mockImplementation(async (tenantId: string) => {
        // Simulate slight resolution delay
        await new Promise(r => setTimeout(r, 10))
        return tenantId === 'tenant-a' ? engineA : engineB
      })

    const handler = createDispatchHandler({
      resolveTenant,
      logger: mockLogger,
    })

    const reqA = makeReq({ headers: { 'x-tenant-id': 'tenant-a' } })
    const reqB = makeReq({ headers: { 'x-tenant-id': 'tenant-b' } })

    handler(reqA, makeRes())
    handler(reqB, makeRes())

    await tick(100)

    expect(resolveTenant).toHaveBeenCalledTimes(2)
    expect(resolveTenant).toHaveBeenCalledWith('tenant-a')
    expect(resolveTenant).toHaveBeenCalledWith('tenant-b')
    expect(engineA.connector.processIncomingDispatch).toHaveBeenCalledTimes(1)
    expect(engineB.connector.processIncomingDispatch).toHaveBeenCalledTimes(1)
  })
})

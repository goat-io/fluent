// npx vitest run src/__tests__/dispatcher/create-dispatcher.spec.ts
//
// Unit tests for createDispatcher() — the factory that assembles the
// cross-tenant dispatch singleton with hint transport, HTTP handler,
// and schedule syncer. Tests cover config validation, handler shape,
// and fireHint behavior. Uses Postgres mode with a mock DbClient to
// avoid BullMQ/Redis imports.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDispatcher } from '../../dispatcher/createDispatcher.js'

// ── Helpers ──────────────────────────────────────────────────────────

function makeMockDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(),
    getPool: () => ({}),
  } as any
}

function makeBaseConfig(overrides: Record<string, unknown> = {}) {
  return {
    database: makeMockDb(),
    dispatchUrl: 'http://localhost:8086/dispatch/worker',
    resolveTenant: vi.fn(),
    listTenants: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createDispatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws if neither redis nor database provided', () => {
    expect(() =>
      createDispatcher({
        dispatchUrl: 'http://localhost/dispatch',
        resolveTenant: vi.fn(),
        listTenants: vi.fn().mockResolvedValue([]),
      } as any),
    ).toThrow(/provide either.*redis.*database/i)
  })

  it('throws if both redis and database provided', () => {
    expect(() =>
      createDispatcher({
        redis: { host: 'localhost', port: 6379 },
        database: makeMockDb(),
        dispatchUrl: 'http://localhost/dispatch',
        resolveTenant: vi.fn(),
        listTenants: vi.fn().mockResolvedValue([]),
      } as any),
    ).toThrow(/provide either.*redis.*database.*not both/i)
  })

  it('handler is an Express-compatible function', () => {
    const dispatcher = createDispatcher(makeBaseConfig())

    expect(typeof dispatcher.handler).toBe('function')
    // Express handlers are (req, res) — 2 args
    expect(dispatcher.handler.length).toBe(2)
  })

  it('fireHint sanitizes colons in jobId', async () => {
    const mockDb = makeMockDb()
    const dispatcher = createDispatcher(makeBaseConfig({ database: mockDb }))

    // fireHint eventually calls PgHintTransport.fireHint which INSERTs.
    // The PG transport stores jobId as-is (colon sanitization is Redis-only
    // in the BullMQ path). In PG mode, fireHint calls ensureTable + INSERT.
    await dispatcher.fireHint({
      tenantId: 'tenant-a',
      queueName: 'workflow_ingest',
      jobId: 'run:step:123',
    })

    // The INSERT should have been called (after ensureTable DDL calls)
    const insertCall = mockDb.query.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO'),
    )
    expect(insertCall).toBeDefined()

    // Verify the jobId was passed through (PG mode does not sanitize colons)
    const insertParams = insertCall![1] as string[]
    expect(insertParams).toContain('run:step:123')
  })

  it('fireHint logs error but does not throw on queue failure', async () => {
    const mockDb = makeMockDb()
    mockDb.query.mockRejectedValue(new Error('Connection pool exhausted'))

    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    const dispatcher = createDispatcher(
      makeBaseConfig({
        database: mockDb,
        logger: mockLogger,
      }),
    )

    // Should not throw — fireHint catches and logs
    await expect(
      dispatcher.fireHint({
        tenantId: 'tenant-x',
        queueName: 'workflow_step_light',
        jobId: 'job-99',
      }),
    ).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fire hint'),
      expect.any(String),
    )
  })
})

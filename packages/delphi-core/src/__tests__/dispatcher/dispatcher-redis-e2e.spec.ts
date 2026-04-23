// Dispatcher hint-fire integration test (Redis transport).
//
// Verifies createDispatcher() can fire and receive hints via BullMQ.
// Does NOT create full engines — that's already proven by
// engine-via-dispatch.spec.ts. This only tests the hint plumbing.
//
// npx vitest run src/__tests__/dispatcher/dispatcher-redis-e2e.spec.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDispatcher } from '../../dispatcher/createDispatcher.js'
import type { Dispatcher } from '../../dispatcher/dispatcher.types.js'

function getGlobalData() {
  return JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'tempData.json'), 'utf-8'),
  ) as {
    redis: { host: string; port: number }
    postgres: {
      host: string
      port: number
      database: string
      username: string
      password: string
    }
  }
}

describe('dispatcher Redis hint transport', { timeout: 30_000 }, () => {
  const data = getGlobalData()
  let dispatcher: Dispatcher
  const received: Array<{ tenantId: string; queueName: string }> = []

  // Mock HTTP server via fetch interception
  const originalFetch = globalThis.fetch

  beforeAll(async () => {
    // Intercept fetch to capture hint HTTP POSTs (no real HTTP server needed)
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async (_url: string, opts: any) => {
        const headers = opts?.headers ?? {}
        const body = opts?.body ? JSON.parse(opts.body) : {}
        received.push({
          tenantId: headers['X-Tenant-ID'] || body.tenantId,
          queueName: body.queueName,
        })
        return { ok: true, status: 202, text: async () => 'ok' } as Response
      })

    dispatcher = createDispatcher({
      redis: {
        host: data.redis.host,
        port: data.redis.port,
        maxRetriesPerRequest: null,
      },
      dispatchUrl: 'http://localhost:9999/dispatch/worker',
      resolveTenant: vi.fn().mockResolvedValue({} as any),
      listTenants: vi.fn().mockResolvedValue([]),
    })

    await dispatcher.start()
  })

  afterAll(async () => {
    await dispatcher?.stop().catch(() => {})
    globalThis.fetch = originalFetch
  })

  it('fires a hint through Redis and the listener delivers it via HTTP', async () => {
    await dispatcher.fireHint({
      tenantId: 'test-tenant',
      queueName: 'workflow_step_light',
      jobId: 'step-123',
    })

    // Wait for hint to travel: enqueue → BullMQ Worker → fetch mock
    const deadline = Date.now() + 10_000
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100))
    }

    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0].tenantId).toBe('test-tenant')
    expect(received[0].queueName).toBe('workflow_step_light')
  })

  it('sanitizes colons in jobId', async () => {
    received.length = 0

    await dispatcher.fireHint({
      tenantId: 'test-tenant',
      queueName: 'workflow_ingest',
      jobId: 'run:step:0',
    })

    const deadline = Date.now() + 10_000
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100))
    }

    // Verify fetch was called (hint delivered)
    expect(received.length).toBeGreaterThanOrEqual(1)
  })
})

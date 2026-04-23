// Dispatcher hint-fire integration test (Postgres transport).
//
// Verifies PgHintTransport can fire hints, store them in dispatch_hints
// table, claim them, and deliver via callback. No BullMQ, no heavy engines.
//
// npx vitest run src/__tests__/dispatcher/dispatcher-pg-e2e.spec.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbClient } from '../../db/DbClient.js'
import { createDbClient } from '../../db/DbClient.js'
import { PgHintTransport } from '../../dispatcher/PgHintTransport.js'

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

describe('PgHintTransport integration', { timeout: 30_000 }, () => {
  const data = getGlobalData()
  let pool: pg.Pool
  let db: DbClient
  let transport: PgHintTransport
  const received: Array<{
    tenantId: string
    queueName: string
    jobId: string
  }> = []

  beforeAll(async () => {
    // Create a dedicated DB for this test
    const admin = new pg.Pool({
      ...data.postgres,
      user: data.postgres.username,
      max: 2,
    })
    await admin.query(`CREATE DATABASE "pg_hint_test"`).catch(() => {})
    await admin.end()

    pool = new pg.Pool({
      host: data.postgres.host,
      port: data.postgres.port,
      database: 'pg_hint_test',
      user: data.postgres.username,
      password: data.postgres.password,
      max: 5,
    })
    db = createDbClient(pool)

    transport = new PgHintTransport({
      db,
      pgPool: pool,
      onHint: async hint => {
        received.push({
          tenantId: hint.tenantId,
          queueName: hint.queueName,
          jobId: hint.jobId,
        })
      },
      dispatchUrl: 'http://localhost:9999/dispatch/worker',
      pollingIntervalMs: 100,
      maxPollingIntervalMs: 500,
    })

    await transport.start()
  })

  afterAll(async () => {
    await transport?.stop().catch(() => {})
    await pool?.end().catch(() => {})
  })

  it('fires a hint and the listener picks it up', async () => {
    await transport.fireHint({
      tenantId: 'tenant-x',
      queueName: 'workflow_step_light',
      jobId: 'step-abc',
    })

    const deadline = Date.now() + 5_000
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50))
    }

    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0].tenantId).toBe('tenant-x')
    expect(received[0].queueName).toBe('workflow_step_light')
    expect(received[0].jobId).toBe('step-abc')
  })

  it('stores hints in dispatch_hints table and marks them claimed', async () => {
    received.length = 0

    await transport.fireHint({
      tenantId: 'tenant-y',
      queueName: 'workflow_ingest',
      jobId: 'run-456',
    })

    // Wait for claim
    const deadline = Date.now() + 5_000
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50))
    }

    const { rows } = await db.query(
      `SELECT * FROM dispatch_hints WHERE "tenantId" = $1`,
      ['tenant-y'],
    )
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].claimedAt).not.toBeNull()
  })

  it('handles multiple hints without losing any', async () => {
    received.length = 0
    const N = 10

    for (let i = 0; i < N; i++) {
      await transport.fireHint({
        tenantId: 'tenant-z',
        queueName: 'workflow_step_light',
        jobId: `batch-${i}`,
      })
    }

    const deadline = Date.now() + 10_000
    while (received.length < N && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50))
    }

    expect(received.length).toBe(N)
  })
})

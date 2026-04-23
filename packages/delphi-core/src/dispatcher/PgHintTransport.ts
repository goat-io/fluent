// PgHintTransport.ts — Postgres-based hint transport (alternative to Redis).
//
// For deployments without Redis, dispatch hints are stored in a
// `dispatch_hints` table on the platform Postgres. Uses LISTEN/NOTIFY
// for low-latency wake + adaptive polling fallback.

import type { Pool, PoolClient } from 'pg'
import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import { AdaptivePoller } from '../engine/AdaptivePoller.js'

const HINT_CHANNEL = 'delphi_dispatch_hint'

export interface PgHintTransportConfig {
  db: DbClient
  pgPool?: Pool
  /** Callback invoked for each hint. Typically fires HTTP POST to dispatch endpoint. */
  onHint: (hint: {
    tenantId: string
    queueName: string
    jobId: string
    dispatchUrl: string
  }) => Promise<void>
  dispatchUrl: string
  pollingIntervalMs?: number
  maxPollingIntervalMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

const CREATE_HINTS_TABLE = `
  CREATE TABLE IF NOT EXISTS dispatch_hints (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "claimedAt" TIMESTAMPTZ
  )
`

const CREATE_HINTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_dispatch_hints_unclaimed
  ON dispatch_hints ("createdAt" ASC) WHERE "claimedAt" IS NULL
`

export class PgHintTransport {
  private readonly db: DbClient
  private readonly pgPool?: Pool
  private readonly onHint: PgHintTransportConfig['onHint']
  private readonly dispatchUrl: string
  private readonly basePollingMs: number
  private readonly maxPollingMs: number
  private readonly logger?: PgHintTransportConfig['logger']
  private running = false
  private migrated = false
  private notifyClient: PoolClient | null = null
  private wakeResolve: (() => void) | null = null

  constructor(config: PgHintTransportConfig) {
    this.db = config.db
    this.pgPool = config.pgPool
    this.onHint = config.onHint
    this.dispatchUrl = config.dispatchUrl
    this.basePollingMs = config.pollingIntervalMs ?? 500
    this.maxPollingMs = config.maxPollingIntervalMs ?? 30_000
    this.logger = config.logger
  }

  private async ensureTable(): Promise<void> {
    if (this.migrated) {
      return
    }
    await this.db.query(CREATE_HINTS_TABLE)
    await this.db.query(CREATE_HINTS_INDEX)
    this.migrated = true
  }

  async fireHint(params: {
    tenantId: string
    queueName: string
    jobId: string
  }): Promise<void> {
    await this.ensureTable()
    const id = nanoId(21)
    await this.db.query(
      `INSERT INTO dispatch_hints (id, "tenantId", "queueName", "jobId") VALUES ($1, $2, $3, $4)`,
      [id, params.tenantId, params.queueName, params.jobId],
    )

    // Fire NOTIFY for low-latency wake
    if (this.pgPool) {
      let client: PoolClient | undefined
      try {
        client = await this.pgPool.connect()
        await client.query(`NOTIFY ${HINT_CHANNEL}, '${id}'`)
      } catch {
        // Non-fatal — polling will pick it up
      } finally {
        client?.release()
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger?.warn('[PgHintTransport] Already started')
      return
    }
    this.running = true
    await this.ensureTable()

    // Set up LISTEN for low-latency wake
    if (this.pgPool) {
      try {
        this.notifyClient = await this.pgPool.connect()
        this.notifyClient.on('notification', () => {
          if (this.wakeResolve) {
            this.wakeResolve()
            this.wakeResolve = null
          }
        })
        this.notifyClient.on('error', err => {
          this.logger?.warn(
            '[PgHintTransport] LISTEN connection error, falling back to polling',
            err.message,
          )
          try {
            this.notifyClient?.release()
          } catch {
            /* ignore */
          }
          this.notifyClient = null
        })
        await this.notifyClient.query(`LISTEN ${HINT_CHANNEL}`)
        this.logger?.info('[PgHintTransport] LISTEN/NOTIFY active')
      } catch {
        this.notifyClient?.release()
        this.notifyClient = null
        this.logger?.info('[PgHintTransport] LISTEN unavailable, using polling')
      }
    }

    // Start poll loop
    void this.pollLoop()
    this.logger?.info('[PgHintTransport] Started')
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.wakeResolve) {
      this.wakeResolve()
      this.wakeResolve = null
    }
    if (this.notifyClient) {
      try {
        await this.notifyClient.query(`UNLISTEN ${HINT_CHANNEL}`)
      } catch {
        /* ignore */
      }
      this.notifyClient.release()
      this.notifyClient = null
    }
    this.logger?.info('[PgHintTransport] Stopped')
  }

  isRunning(): boolean {
    return this.running
  }

  private async pollLoop(): Promise<void> {
    const poller = new AdaptivePoller({
      minIntervalMs: this.basePollingMs,
      maxIntervalMs: this.maxPollingMs,
    })

    while (this.running) {
      try {
        const processed = await this.processPendingHints()
        if (processed > 0) {
          poller.onSuccess()
        } else {
          poller.onIdle()
        }
      } catch (err) {
        poller.onContention()
        this.logger?.warn(
          '[PgHintTransport] Poll error:',
          (err as Error).message,
        )
      }

      if (this.running) {
        await Promise.race([
          new Promise<void>(resolve =>
            setTimeout(resolve, poller.getIntervalMs()),
          ),
          new Promise<void>(resolve => {
            this.wakeResolve = resolve
          }),
        ])
      }
    }
  }

  private async processPendingHints(): Promise<number> {
    const { rows } = await this.db.query<{
      id: string
      tenantId: string
      queueName: string
      jobId: string
    }>(
      `WITH claimed AS (
        SELECT id FROM dispatch_hints
        WHERE "claimedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      UPDATE dispatch_hints dh
      SET "claimedAt" = NOW()
      FROM claimed
      WHERE dh.id = claimed.id
      RETURNING dh.id, dh."tenantId", dh."queueName", dh."jobId"`,
    )

    if (rows.length === 0) {
      return 0
    }

    const settled = await Promise.allSettled(
      rows.map(hint =>
        this.onHint({
          tenantId: hint.tenantId,
          queueName: hint.queueName,
          jobId: hint.jobId,
          dispatchUrl: this.dispatchUrl,
        }),
      ),
    )

    let processed = 0
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        processed++
      } else {
        this.logger?.error(
          '[PgHintTransport] Hint handler failed:',
          (r.reason as Error)?.message,
        )
      }
    }

    return processed
  }
}

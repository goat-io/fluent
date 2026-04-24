// npx vitest run src/__tests__/engine/pg-dispatcher.spec.ts
//
// Postgres-only queue connector that replaces BullMQ/Redis.
// Uses the FOR UPDATE SKIP LOCKED pattern (DBOS-inspired).

import type { TaskConnector, TaskStatus } from '@goatlab/tasks-core'
import type { Pool, PoolClient } from 'pg'
import type { DbClient } from '../db/DbClient.js'
import { fromJson } from '../entities/Database.js'
import { AdaptivePoller } from './AdaptivePoller.js'

export interface PgConnectorConfig {
  db: DbClient
  pgPool?: Pool
  pollingIntervalMs?: number
  maxPollingIntervalMs?: number
  tenantId?: string
  /** Callback fired after a step is queued. Used by dispatcher for cross-tenant hints. */
  onAfterQueue?: (params: {
    queueName: string
    jobId: string
  }) => void | Promise<void>
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

const NOTIFY_CHANNEL = 'delphi_step_queued'

export class PgConnector implements TaskConnector<object> {
  readonly tenantId?: string

  private readonly db: DbClient
  private readonly pgPool?: Pool
  private readonly basePollingMs: number
  private readonly maxPollingMs: number
  private readonly onAfterQueueCb?: PgConnectorConfig['onAfterQueue']
  private readonly logger?: PgConnectorConfig['logger']

  constructor(config: PgConnectorConfig) {
    this.db = config.db
    this.pgPool = config.pgPool
    this.basePollingMs = config.pollingIntervalMs ?? 500
    this.maxPollingMs = config.maxPollingIntervalMs ?? 30_000
    this.tenantId = config.tenantId
    this.onAfterQueueCb = config.onAfterQueue
    this.logger = config.logger
  }

  async queue(params: {
    uniqueTaskName: string
    taskName: string
    postUrl: string
    taskBody: object
    handle: () => Promise<any>
  }): Promise<Omit<TaskStatus, 'payload'>> {
    // Fire-and-forget NOTIFY — don't block the caller waiting for a PG pool connection.
    // The poll loop will pick up the step regardless; NOTIFY just reduces latency.
    this.notifyDebounced()

    // Fire dispatch hint for cross-tenant routing (if dispatcher is wired).
    if (this.onAfterQueueCb) {
      try {
        void this.onAfterQueueCb({
          queueName: params.taskName,
          jobId: params.uniqueTaskName,
        })
      } catch {
        // Non-fatal — job is already queued in PG.
      }
    }

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
  }

  async bulkQueue(
    jobs: Array<{
      uniqueTaskName: string
      taskName: string
      taskBody: object
      opts?: Record<string, unknown>
    }>,
  ): Promise<Omit<TaskStatus, 'payload'>[]> {
    if (jobs.length > 0) {
      this.notifyDebounced()
    }
    return jobs.map(j => ({
      id: j.uniqueTaskName,
      name: j.taskName,
      status: 'QUEUED' as const,
      output: '',
      attempts: 0,
      created: new Date().toISOString(),
      nextRun: null,
      nextRunMinutes: null,
    }))
  }

  async getStatus(id: string): Promise<TaskStatus> {
    const parsed = PgConnector.parseJobId(id)
    if (!parsed) {
      return {
        id,
        name: 'unknown',
        status: 'FAILED',
        output: '',
        attempts: 0,
        created: '',
        nextRun: null,
        nextRunMinutes: null,
        payload: {} as any,
      }
    }

    const { rows } = await this.db.query(
      `SELECT * FROM workflow_steps WHERE "workflowRunId" = $1 AND "stepName" = $2`,
      [parsed.runId, parsed.stepName],
    )
    const step = rows[0]

    if (!step) {
      return {
        id,
        name: 'unknown',
        status: 'FAILED',
        output: '',
        attempts: 0,
        created: '',
        nextRun: null,
        nextRunMinutes: null,
        payload: {} as any,
      }
    }

    const statusMap: Record<string, TaskStatus['status']> = {
      QUEUED: 'QUEUED',
      RUNNING: 'RUNNING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
      PENDING: 'QUEUED',
      SKIPPED: 'COMPLETED',
      WAITING_HUMAN: 'RUNNING',
      SLEEPING: 'RUNNING',
    }

    return {
      id,
      name: step.stepName,
      status: statusMap[step.status] ?? 'QUEUED',
      output: step.output ?? '',
      attempts: step.attempt,
      created: String(step.createdAt),
      nextRun: null,
      nextRunMinutes: null,
      payload: (fromJson(step.input) ?? {}) as any,
    }
  }

  forTenant(tenantId: string): TaskConnector<object> {
    return new PgConnector({
      db: this.db,
      pgPool: this.pgPool,
      pollingIntervalMs: this.basePollingMs,
      maxPollingIntervalMs: this.maxPollingMs,
      tenantId,
      onAfterQueue: this.onAfterQueueCb,
      logger: this.logger,
    })
  }

  async processIncomingDispatch(params: {
    handleTask: (queueName: string, data: unknown) => Promise<unknown>
    timeBudgetMs?: number
    validQueueNames?: Set<string>
    batchSize?: number
    concurrency?: number
    hint?: { tenantId?: string; queueName?: string; jobId?: string }
  }): Promise<{ processed: number; failed: number }> {
    const timeBudget = params.timeBudgetMs ?? 120_000
    const batchSize = Math.max(1, params.batchSize ?? 50)
    const concurrency = Math.max(1, params.concurrency ?? batchSize)
    const deadline = Date.now() + timeBudget
    let processed = 0
    let failed = 0

    while (Date.now() < deadline) {
      const claimed = await this.claimSteps(batchSize)
      if (claimed.length === 0) {
        break
      }

      // Process in chunks capped by concurrency
      for (let off = 0; off < claimed.length; off += concurrency) {
        const chunk = claimed.slice(off, off + concurrency)
        const settled = await Promise.allSettled(
          chunk.map(step => {
            const payload = this.stepRowToPayload(step)
            // Route to the correct queue name based on step weight
            const queueName =
              step.executorType === 'sandbox'
                ? 'workflow_step_sandbox'
                : 'workflow_step_light'
            return params.handleTask(queueName, payload)
          }),
        )

        for (const result of settled) {
          if (result.status === 'fulfilled') {
            processed++
          } else {
            failed++
            this.logger?.warn?.(
              '[PgConnector] processIncomingDispatch handler error:',
              (result.reason as Error)?.message,
            )
          }
        }
      }
    }

    return { processed, failed }
  }

  async listen(params: {
    tasks: Array<{
      taskName: string
      handle: (data: unknown) => Promise<unknown>
      concurrency?: number
    }>
    defaultConcurrency?: number
  }): Promise<{ stop: () => Promise<void>; isRunning: () => boolean }> {
    const handlers = new Map<string, (data: unknown) => Promise<unknown>>()
    for (const task of params.tasks) {
      handlers.set(task.taskName, task.handle)
    }

    const concurrency = params.defaultConcurrency ?? 5
    let running = true
    let inFlight = 0
    let wakeResolve: (() => void) | null = null

    const poller = new AdaptivePoller({
      minIntervalMs: this.basePollingMs,
      maxIntervalMs: this.maxPollingMs,
    })

    let notifyClient: PoolClient | null = null
    if (this.pgPool) {
      const canListen = await this.selfTestListenNotify()
      if (canListen) {
        try {
          notifyClient = await this.pgPool.connect()
          notifyClient.on('notification', () => {
            if (wakeResolve) {
              wakeResolve()
              wakeResolve = null
            }
          })
          notifyClient.on('error', err => {
            this.logger?.warn?.(
              '[PgConnector] LISTEN connection error, falling back to polling',
              err.message,
            )
            try {
              notifyClient?.release()
            } catch {
              /* ignore */
            }
            notifyClient = null
          })
          await notifyClient.query(`LISTEN ${NOTIFY_CHANNEL}`)
          this.logger?.info?.(
            '[PgConnector] LISTEN/NOTIFY self-test passed — using low-latency dispatch (~1ms)',
          )
        } catch (err) {
          this.logger?.warn?.(
            '[PgConnector] LISTEN setup failed after self-test, falling back to polling',
            (err as Error).message,
          )
          notifyClient?.release()
          notifyClient = null
        }
      } else {
        this.logger?.info?.(
          '[PgConnector] LISTEN/NOTIFY unavailable (proxy detected) — using polling dispatch (~1s)',
        )
      }
    } else {
      this.logger?.info?.(
        '[PgConnector] No pgPool — using polling dispatch (~1s)',
      )
    }

    const pollLoop = async () => {
      while (running) {
        try {
          const claimed = await this.claimSteps(concurrency - inFlight)

          if (claimed.length > 0) {
            poller.onSuccess()
            inFlight += claimed.length

            for (const step of claimed) {
              const handler = handlers.values().next().value!
              const payload = this.stepRowToPayload(step)

              ;(async () => {
                try {
                  await handler(payload)
                } catch (err) {
                  this.logger?.warn?.(
                    `[PgConnector] Handler error for step ${step.stepName} in run ${step.workflowRunId}:`,
                    (err as Error).message,
                  )
                } finally {
                  inFlight--
                }
              })()
            }
          } else {
            poller.onIdle()
          }
        } catch (err) {
          poller.onContention()
          this.logger?.warn?.(
            '[PgConnector] Poll error:',
            (err as Error).message,
          )
        }

        if (running) {
          await Promise.race([
            new Promise<void>(resolve =>
              setTimeout(resolve, poller.getIntervalMs()),
            ),
            new Promise<void>(resolve => {
              wakeResolve = resolve
            }),
          ])
        }
      }
    }

    const loopPromise = pollLoop()

    return {
      stop: async () => {
        running = false
        if (wakeResolve) {
          wakeResolve()
          wakeResolve = null
        }
        await loopPromise

        if (notifyClient) {
          try {
            await notifyClient.query(`UNLISTEN ${NOTIFY_CHANNEL}`)
          } catch {
            // ignore
          }
          notifyClient.release()
          notifyClient = null
        }
      },
      isRunning: () => running,
    }
  }

  private async claimSteps(limit: number) {
    if (limit <= 0) {
      return []
    }

    let tenantFilter = ''
    const params: any[] = [limit]
    if (this.tenantId) {
      tenantFilter = `AND "tenantId" = $2`
      params.push(this.tenantId)
    }

    const { rows } = await this.db.query<{
      id: string
      workflowRunId: string
      tenantId: string
      stepName: string
      status: string
      executorType: string
      executorConfig: string | null
      input: string | null
      attempt: number
      lastHeartbeatData: string | null
      heartbeatTimeoutMs: number | null
      iterationCount: number | null
    }>(
      `WITH claimed AS (
        SELECT id
        FROM workflow_steps
        WHERE (
          status = 'QUEUED'
          OR (status = 'RUNNING' AND "startedAt" IS NULL)
        )
        AND ("retryAfterMs" IS NULL OR "retryAfterMs" <= (extract(epoch from now()) * 1000)::BIGINT)
        ${tenantFilter}
        ORDER BY "scheduledAt" ASC NULLS LAST, "createdAt" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE workflow_steps ws
      SET status = 'RUNNING', "startedAt" = NOW(), "updatedAt" = NOW(), "retryAfterMs" = NULL
      FROM claimed
      WHERE ws.id = claimed.id
      RETURNING ws.id, ws."workflowRunId", ws."tenantId", ws."stepName",
                ws.status, ws."executorType", ws."executorConfig",
                ws.input, ws.attempt, ws."lastHeartbeatData",
                ws."heartbeatTimeoutMs", ws."iterationCount"`,
      params,
    )

    return rows
  }

  private stepRowToPayload(step: {
    workflowRunId: string
    tenantId: string
    stepName: string
    executorType: string
    executorConfig: string | null
    input: string | null
    attempt: number
    lastHeartbeatData: string | null
    heartbeatTimeoutMs: number | null
  }): object {
    return {
      workflowRunId: step.workflowRunId,
      stepName: step.stepName,
      tenantId: step.tenantId,
      input: fromJson(step.input) ?? {},
      attempt: step.attempt,
      executorType: step.executorType,
      executorConfig: fromJson(step.executorConfig) ?? {},
      lastHeartbeatData: fromJson(step.lastHeartbeatData) ?? undefined,
      heartbeatTimeoutMs: step.heartbeatTimeoutMs ?? undefined,
    }
  }

  private async selfTestListenNotify(): Promise<boolean> {
    if (!this.pgPool) {
      return false
    }

    const testChannel = 'delphi_dispatch_selftest'
    const testPayload = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    let client: PoolClient | null = null

    try {
      client = await this.pgPool.connect()
      let received = false

      client.setMaxListeners(20)
      client.on('notification', msg => {
        if (msg.channel === testChannel && msg.payload === testPayload) {
          received = true
        }
      })

      await client.query(`LISTEN ${testChannel}`)
      await client.query(`NOTIFY ${testChannel}, '${testPayload}'`)

      for (let i = 0; i < 30 && !received; i++) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      await client.query(`UNLISTEN ${testChannel}`)
      return received
    } catch {
      return false
    } finally {
      client?.release()
    }
  }

  // ── Debounced NOTIFY ──────────────────────────────────────────────
  // Under high load, hundreds of queue() calls/sec each trying to NOTIFY
  // would saturate the PG pool. Instead, coalesce into at most 1 NOTIFY
  // per 10ms — the poll loop wakes up once and drains all queued steps.

  private notifyTimer: ReturnType<typeof setTimeout> | null = null

  private notifyDebounced(): void {
    if (this.notifyTimer || !this.pgPool) {
      return
    }
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null
      this.notify('wake').catch(() => {})
    }, 10)
  }

  private async notify(payload: string): Promise<void> {
    if (!this.pgPool) {
      return
    }
    let client: PoolClient | undefined
    try {
      client = await this.pgPool.connect()
      await client.query(
        `NOTIFY ${NOTIFY_CHANNEL}, '${payload.replace(/'/g, "''")}'`,
      )
    } catch (err) {
      this.logger?.debug?.(
        '[PgConnector] NOTIFY failed:',
        (err as Error).message,
      )
    } finally {
      client?.release()
    }
  }

  static parseJobId(jobId: string): {
    runId: string
    stepName: string
    attempt: number
    iteration: number
  } | null {
    const prefix = 'wf-'
    if (!jobId.startsWith(prefix)) {
      return null
    }

    const rest = jobId.slice(prefix.length)
    const iIdx = rest.lastIndexOf('-i')
    if (iIdx < 0) {
      return null
    }
    const iteration = Number.parseInt(rest.slice(iIdx + 2), 10)
    if (Number.isNaN(iteration)) {
      return null
    }

    const beforeI = rest.slice(0, iIdx)
    const attemptIdx = beforeI.lastIndexOf('-')
    if (attemptIdx < 0) {
      return null
    }
    const attempt = Number.parseInt(beforeI.slice(attemptIdx + 1), 10)
    if (Number.isNaN(attempt)) {
      return null
    }

    const beforeAttempt = beforeI.slice(0, attemptIdx)
    const lastDash = beforeAttempt.lastIndexOf('-')
    if (lastDash < 0) {
      return null
    }
    const runId = beforeAttempt.slice(0, lastDash)
    const stepName = beforeAttempt.slice(lastDash + 1)

    return { runId, stepName, attempt, iteration }
  }
}

// npx vitest run src/__tests__/engine/scheduler.spec.ts
//
// SchedulerService — durable, idempotent recurring triggers via cron expressions.
// All times stored as epoch milliseconds to avoid timezone issues.
//

import { CronExpressionParser } from 'cron-parser'
import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { WorkflowSchedule } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import type { EventIngestionService } from '../events/EventIngestion.js'

export interface SchedulerServiceConfig {
  db: DbClient
  eventIngestion: EventIngestionService
  engine?: WorkflowEngine
  tenantId: string
  pollIntervalMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

/** Parse a cron expression and return the next run as epoch ms. */
function nextRunEpochMs(
  cronExpression: string,
  currentDate?: Date,
  timezone: string = 'UTC',
): number {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate,
    tz: timezone,
  })
  return interval.next().toDate().getTime()
}

export class SchedulerService {
  private db: DbClient
  private eventIngestion: EventIngestionService
  private engine: WorkflowEngine | null
  private tenantId: string
  private pollIntervalMs: number
  private timer?: ReturnType<typeof setInterval>
  private logger?: SchedulerServiceConfig['logger']

  constructor(config: SchedulerServiceConfig) {
    this.db = config.db
    this.eventIngestion = config.eventIngestion
    this.engine = config.engine ?? null
    this.tenantId = config.tenantId
    this.pollIntervalMs = config.pollIntervalMs ?? 60_000
    this.logger = config.logger
  }

  start(): void {
    if (this.timer) {
      return
    }
    this.timer = setInterval(() => {
      this.tick().catch(err => {
        this.logger?.error(
          `Scheduler tick error: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
    }, this.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  async tick(): Promise<number> {
    let emitted = 0
    const nowMs = Date.now()

    await this.db.transaction(async client => {
      const { rows: dueSchedules } = await client.query<WorkflowSchedule>(
        `SELECT * FROM workflow_schedules
         WHERE active = true
           AND "tenantId" = $1
           AND "nextRunAtEpochMs" <= $2
         FOR UPDATE SKIP LOCKED`,
        [this.tenantId, nowMs],
      )

      for (const schedule of dueSchedules) {
        const scheduledAtMs = Number(schedule.nextRunAtEpochMs)
        const idempotencyKey = `cron:${schedule.workflowName}:${scheduledAtMs}`
        const input = (fromJson(schedule.input) ?? {}) as Record<
          string,
          unknown
        >

        if (this.engine) {
          try {
            await this.engine.start({
              workflowName: schedule.workflowName,
              tenantId: schedule.tenantId,
              input: input as any,
              idempotencyKey,
            })
            emitted++
          } catch (err: any) {
            if (err.name === 'IdempotencyConflictError') {
              // Already running for this schedule tick
            } else {
              this.logger?.error(
                `Scheduler failed to start ${schedule.workflowName}: ${err.message}`,
              )
            }
          }
        } else {
          const result = await this.eventIngestion.ingest({
            tenantId: schedule.tenantId,
            eventType: 'cron.trigger',
            source: 'scheduler',
            payload: {
              workflowName: schedule.workflowName,
              scheduleId: schedule.id,
              scheduledAt: new Date(scheduledAtMs).toISOString(),
              cronExpression: schedule.cronExpression,
              input,
            },
            idempotencyKey,
          })

          if (!result.duplicate) {
            emitted++
          }
        }

        const nextMs = nextRunEpochMs(
          schedule.cronExpression,
          new Date(scheduledAtMs),
          schedule.timezone || 'UTC',
        )

        await client.query(
          `UPDATE workflow_schedules SET "nextRunAtEpochMs" = $1, "lastRunAtEpochMs" = $2 WHERE id = $3`,
          [nextMs, scheduledAtMs, schedule.id],
        )

        this.logger?.info(
          `Scheduler triggered ${schedule.workflowName} (next: ${new Date(nextMs).toISOString()})`,
        )
      }
    })

    // Sweep delayed workflows that are due for execution
    if (this.engine) {
      try {
        await (this.engine as any).processDelayedWorkflows()
      } catch (err: any) {
        this.logger?.error(
          `Delayed workflow sweep error: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return emitted
  }

  async createSchedule(
    tenantId: string,
    workflowName: string,
    cronExpression: string,
    input?: Record<string, unknown>,
    opts?: { timezone?: string; runOnInit?: boolean },
  ): Promise<string> {
    const id = nanoId(21)
    const timezone = opts?.timezone ?? 'UTC'
    const runOnInit = opts?.runOnInit ?? false
    const firstRunMs = runOnInit
      ? Date.now() // fire immediately on next tick
      : nextRunEpochMs(cronExpression, undefined, timezone)

    await this.db.query(
      `INSERT INTO workflow_schedules (id, "tenantId", "workflowName", "cronExpression", timezone, "runOnInit", input, "nextRunAtEpochMs", "lastRunAtEpochMs", active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        tenantId,
        workflowName,
        cronExpression,
        timezone,
        runOnInit,
        toJson(input ?? null),
        firstRunMs,
        null,
        true,
      ],
    )

    return id
  }

  async upsertSchedule(
    tenantId: string,
    workflowName: string,
    cronExpression: string,
    input?: Record<string, unknown>,
    opts?: { timezone?: string; runOnInit?: boolean },
  ): Promise<string> {
    const id = `sched:${tenantId}:${workflowName}`
    const timezone = opts?.timezone ?? 'UTC'
    const runOnInit = opts?.runOnInit ?? false
    const firstRunMs = runOnInit
      ? Date.now()
      : nextRunEpochMs(cronExpression, undefined, timezone)

    await this.db.query(
      `INSERT INTO workflow_schedules (id, "tenantId", "workflowName", "cronExpression", timezone, "runOnInit", input, "nextRunAtEpochMs", "lastRunAtEpochMs", active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET
         "cronExpression" = EXCLUDED."cronExpression",
         timezone = EXCLUDED.timezone,
         "runOnInit" = EXCLUDED."runOnInit",
         input = EXCLUDED.input,
         "nextRunAtEpochMs" = EXCLUDED."nextRunAtEpochMs",
         active = true`,
      [
        id,
        tenantId,
        workflowName,
        cronExpression,
        timezone,
        runOnInit,
        toJson(input ?? null),
        firstRunMs,
        null,
      ],
    )

    return id
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.db.query(
      `UPDATE workflow_schedules SET active = $1 WHERE id = $2`,
      [false, scheduleId],
    )
  }

  async listSchedules(tenantId: string): Promise<WorkflowSchedule[]> {
    const { rows } = await this.db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE "tenantId" = $1 AND active = true ORDER BY "createdAt" ASC`,
      [tenantId],
    )
    return rows
  }
}

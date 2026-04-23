// npx vitest run src/__tests__/engine/scheduler.spec.ts
//
// SchedulerService — durable, idempotent recurring triggers via cron expressions.
//

import { CronExpressionParser } from 'cron-parser'
import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { WorkflowSchedule } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import type { EventIngestionService } from '../events/EventIngestion.js'

export interface SchedulerServiceConfig {
  db: DbClient
  eventIngestion: EventIngestionService
  tenantId: string
  pollIntervalMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export class SchedulerService {
  private db: DbClient
  private eventIngestion: EventIngestionService
  private tenantId: string
  private pollIntervalMs: number
  private timer?: ReturnType<typeof setInterval>
  private logger?: SchedulerServiceConfig['logger']

  constructor(config: SchedulerServiceConfig) {
    this.db = config.db
    this.eventIngestion = config.eventIngestion
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
        this.logger?.error('Scheduler tick error', err)
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

    // Wrap in transaction so FOR UPDATE locks hold across the inner work.
    await this.db.transaction(async client => {
      const { rows: dueSchedules } = await client.query<WorkflowSchedule>(
        `SELECT * FROM workflow_schedules
         WHERE active = true
           AND "tenantId" = $1
           AND "nextRunAt" <= NOW()
         FOR UPDATE SKIP LOCKED`,
        [this.tenantId],
      )

      for (const schedule of dueSchedules) {
        const scheduledAt = new Date(schedule.nextRunAt).toISOString()
        const idempotencyKey = `cron:${schedule.workflowName}:${scheduledAt}`

        const result = await this.eventIngestion.ingest({
          tenantId: schedule.tenantId,
          eventType: 'cron.trigger',
          source: 'scheduler',
          payload: {
            workflowName: schedule.workflowName,
            scheduleId: schedule.id,
            scheduledAt,
            cronExpression: schedule.cronExpression,
            input: fromJson(schedule.input),
          },
          idempotencyKey,
        })

        if (!result.duplicate) {
          emitted++
        }

        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          currentDate: new Date(schedule.nextRunAt),
        })
        const nextRun = interval.next().toDate()

        await client.query(
          `UPDATE workflow_schedules SET "nextRunAt" = $1, "lastRunAt" = $2 WHERE id = $3`,
          [nextRun, new Date(schedule.nextRunAt), schedule.id],
        )

        this.logger?.info(
          `Scheduler triggered ${schedule.workflowName} (next: ${nextRun.toISOString()})`,
        )
      }
    })

    return emitted
  }

  async createSchedule(
    tenantId: string,
    workflowName: string,
    cronExpression: string,
    input?: Record<string, unknown>,
  ): Promise<string> {
    const id = nanoId(21)
    const interval = CronExpressionParser.parse(cronExpression)
    const nextRunAt = interval.next().toDate()

    await this.db.query(
      `INSERT INTO workflow_schedules (id, "tenantId", "workflowName", "cronExpression", input, "nextRunAt", "lastRunAt", active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        tenantId,
        workflowName,
        cronExpression,
        toJson(input ?? null),
        nextRunAt,
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
  ): Promise<string> {
    const id = `sched:${tenantId}:${workflowName}`
    const interval = CronExpressionParser.parse(cronExpression)
    const nextRunAt = interval.next().toDate()

    await this.db.query(
      `INSERT INTO workflow_schedules (id, "tenantId", "workflowName", "cronExpression", input, "nextRunAt", "lastRunAt", active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (id) DO UPDATE SET
         "cronExpression" = EXCLUDED."cronExpression",
         input = EXCLUDED.input,
         "nextRunAt" = EXCLUDED."nextRunAt",
         active = true`,
      [id, tenantId, workflowName, cronExpression, toJson(input ?? null), nextRunAt, null],
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

// npx vitest run src/__tests__/engine/scheduler.spec.ts
//
// SchedulerService — durable, idempotent recurring triggers via cron expressions.
// Emits cron.trigger events through EventIngestionService (does not start workflows directly).
//

import { Ids } from '@goatlab/js-utils'
import { CronExpressionParser } from 'cron-parser'
import { type Kysely, sql } from 'kysely'
import type { Database, WorkflowSchedule } from '../entities/Database.js'
import type { EventIngestionService } from '../events/EventIngestion.js'

export interface SchedulerServiceConfig {
  db: Kysely<Database>
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
  private db: Kysely<Database>
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

  /**
   * Single poll cycle. Returns the number of cron.trigger events emitted.
   *
   * Multi-pod safety story (TWO independent layers — defense in depth):
   *
   *   1. Row-level locking — the SELECT runs inside a transaction with
   *      `FOR UPDATE SKIP LOCKED`, so concurrent scheduler instances on
   *      the same DB cannot grab the same schedule row. The transaction
   *      wrapper is critical: without it, `FOR UPDATE` releases the lock
   *      immediately when the SELECT returns, defeating the protection.
   *
   *   2. Idempotent event ingestion — each cron.trigger uses
   *      `idempotencyKey: "cron:<workflowName>:<scheduledAt>"`. The
   *      UNIQUE constraint on workflow_events.idempotencyKey ensures
   *      that even if both safeguards above fail, only one cron.trigger
   *      event lands in PG → only one workflow run is started.
   *
   * Tenant scoping: the SELECT filters by `this.tenantId`. In a
   * multi-tenant deployment (one scheduler per tenant per pod), each
   * scheduler only processes its own tenant's schedules — avoids
   * cross-tenant lock contention even when schedules share a DB.
   */
  async tick(): Promise<number> {
    let emitted = 0

    // Wrap in transaction so FOR UPDATE locks hold across the inner work.
    // Without this, `FOR UPDATE` releases the lock immediately after the
    // SELECT returns (auto-commit), letting parallel pods grab the same row.
    await this.db.transaction().execute(async tx => {
      const dueSchedules = await sql<WorkflowSchedule>`
        SELECT * FROM workflow_schedules
        WHERE active = true
          AND "tenantId" = ${this.tenantId}
          AND "nextRunAt" <= NOW()
        FOR UPDATE SKIP LOCKED
      `.execute(tx)

      for (const schedule of dueSchedules.rows) {
        const scheduledAt = new Date(schedule.nextRunAt).toISOString()
        const idempotencyKey = `cron:${schedule.workflowName}:${scheduledAt}`

        // Emit cron.trigger event. Defense-in-depth via UNIQUE(idempotencyKey).
        // Note: this goes through the engine's main db, NOT the locked tx,
        // so even if a parallel pod somehow bypassed the row lock, the
        // UNIQUE constraint would catch the duplicate.
        const result = await this.eventIngestion.ingest({
          tenantId: schedule.tenantId,
          eventType: 'cron.trigger',
          source: 'scheduler',
          payload: {
            workflowName: schedule.workflowName,
            scheduleId: schedule.id,
            scheduledAt,
            cronExpression: schedule.cronExpression,
          },
          idempotencyKey,
        })

        if (!result.duplicate) {
          emitted++
        }

        // Calculate next run + UPDATE (within the same tx — atomic w.r.t. SELECT lock)
        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          currentDate: new Date(schedule.nextRunAt),
        })
        const nextRun = interval.next().toDate()

        await tx
          .updateTable('workflow_schedules')
          .set({
            nextRunAt: nextRun,
            lastRunAt: new Date(schedule.nextRunAt),
          })
          .where('id', '=', schedule.id)
          .execute()

        this.logger?.info(
          `Scheduler triggered ${schedule.workflowName} (next: ${nextRun.toISOString()})`,
        )
      }
    })

    return emitted
  }

  /**
   * Create a new schedule. Returns the schedule ID.
   */
  async createSchedule(
    tenantId: string,
    workflowName: string,
    cronExpression: string,
  ): Promise<string> {
    const id = Ids.nanoId(21)
    const interval = CronExpressionParser.parse(cronExpression)
    const nextRunAt = interval.next().toDate()

    await this.db
      .insertInto('workflow_schedules')
      .values({
        id,
        tenantId,
        workflowName,
        cronExpression,
        nextRunAt,
        lastRunAt: null,
        active: true,
      })
      .execute()

    return id
  }

  /**
   * Soft-delete a schedule by setting active=false.
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.db
      .updateTable('workflow_schedules')
      .set({ active: false })
      .where('id', '=', scheduleId)
      .execute()
  }

  /**
   * List all schedules for a tenant.
   */
  async listSchedules(tenantId: string): Promise<WorkflowSchedule[]> {
    return this.db
      .selectFrom('workflow_schedules')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .where('active', '=', true)
      .orderBy('createdAt', 'asc')
      .execute()
  }
}

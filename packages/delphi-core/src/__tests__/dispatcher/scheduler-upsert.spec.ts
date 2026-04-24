// npx vitest run src/__tests__/dispatcher/scheduler-upsert.spec.ts
//
// Integration tests for SchedulerService.upsertSchedule() — real Postgres
// via testcontainers. Verifies deterministic ID generation, conflict
// resolution, soft-delete reactivation, nextRunAtEpochMs computation, idempotency,
// and backward compatibility with the existing createSchedule (random ID) path.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import type { WorkflowSchedule } from '../../entities/Database.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { SchedulerService } from '../../scheduler/SchedulerService.js'
import { getSharedDb, releaseSharedDb, truncateAll } from '../engine/shared.js'

// ── Setup ────────────────────────────────────────────────────────────

describe('SchedulerService.upsertSchedule', () => {
  let db: TestDb
  let eventIngestion: EventIngestionService
  let scheduler: SchedulerService
  const TENANT = 'upsert-test-tenant'

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    await db.query(`TRUNCATE TABLE workflow_schedules CASCADE`)

    eventIngestion = new EventIngestionService({ db, skipAutoProcess: true })
    scheduler = new SchedulerService({
      db,
      eventIngestion,
      tenantId: TENANT,
    })
  })

  // ── Tests ──────────────────────────────────────────────────────────

  it('creates new schedule with deterministic ID', async () => {
    const id = await scheduler.upsertSchedule(
      TENANT,
      'daily-report',
      '0 9 * * *',
    )

    // The deterministic ID should follow the pattern sched:{tenantId}:{workflowName}
    expect(id).toBe(`sched:${TENANT}:daily-report`)

    // Verify the row exists in the database
    const { rows } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].tenantId).toBe(TENANT)
    expect(rows[0].workflowName).toBe('daily-report')
    expect(rows[0].cronExpression).toBe('0 9 * * *')
    expect(rows[0].active).toBe(true)
  })

  it('updates existing schedule on conflict (change cron expression)', async () => {
    // First insert
    const id1 = await scheduler.upsertSchedule(
      TENANT,
      'nightly-sync',
      '0 2 * * *',
    )

    // Capture the first nextRunAtEpochMs
    const { rows: before } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [id1],
    )
    expect(before).toHaveLength(1)
    expect(before[0].cronExpression).toBe('0 2 * * *')

    // Upsert with a different cron expression
    const id2 = await scheduler.upsertSchedule(
      TENANT,
      'nightly-sync',
      '30 3 * * *',
    )

    // Same deterministic ID
    expect(id2).toBe(id1)

    // Verify the cron expression was updated
    const { rows: after } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [id2],
    )
    expect(after).toHaveLength(1)
    expect(after[0].cronExpression).toBe('30 3 * * *')

    // nextRunAtEpochMs should have been recomputed for the new cron expression
    const newNextRun = new Date(Number(after[0].nextRunAtEpochMs))
    expect(newNextRun.getTime()).toBeGreaterThan(Date.now() - 1000)
  })

  it('reactivates soft-deleted schedule', async () => {
    // Create and then soft-delete
    const id = await scheduler.upsertSchedule(
      TENANT,
      'cleanup-job',
      '0 0 * * 0',
    )
    await scheduler.deleteSchedule(id)

    // Verify it is inactive
    const { rows: deleted } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [id],
    )
    expect(deleted).toHaveLength(1)
    expect(deleted[0].active).toBe(false)

    // Upsert should reactivate it
    const reactivatedId = await scheduler.upsertSchedule(
      TENANT,
      'cleanup-job',
      '0 0 * * 0',
    )
    expect(reactivatedId).toBe(id)

    // Verify it is active again
    const { rows: reactivated } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [reactivatedId],
    )
    expect(reactivated).toHaveLength(1)
    expect(reactivated[0].active).toBe(true)
  })

  it('computes correct nextRunAtEpochMs', async () => {
    // Use a cron expression with predictable next run: every 5 minutes
    const id = await scheduler.upsertSchedule(
      TENANT,
      'frequent-check',
      '*/5 * * * *',
    )

    const { rows } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE id = $1`,
      [id],
    )
    expect(rows).toHaveLength(1)

    const nextRun = new Date(Number(rows[0].nextRunAtEpochMs))
    const now = new Date()

    // nextRunAtEpochMs should be in the future (within a reasonable window)
    expect(nextRun.getTime()).toBeGreaterThan(now.getTime() - 1000)
    // Should be within 5 minutes from now (since cron is */5)
    expect(nextRun.getTime()).toBeLessThanOrEqual(
      now.getTime() + 5 * 60 * 1000 + 1000,
    )

    // Verify the minutes are on a 5-minute boundary
    expect(nextRun.getMinutes() % 5).toBe(0)
  })

  it('is idempotent (call twice with same args, same result)', async () => {
    const cronExpr = '0 6 * * *'
    const input = { reportType: 'daily' }

    const id1 = await scheduler.upsertSchedule(
      TENANT,
      'morning-report',
      cronExpr,
      input,
    )
    const id2 = await scheduler.upsertSchedule(
      TENANT,
      'morning-report',
      cronExpr,
      input,
    )

    // Same ID returned both times
    expect(id1).toBe(id2)

    // Only one row in the database
    const { rows } = await db.query<WorkflowSchedule>(
      `SELECT * FROM workflow_schedules WHERE "workflowName" = $1 AND "tenantId" = $2`,
      ['morning-report', TENANT],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].cronExpression).toBe(cronExpr)
    expect(rows[0].active).toBe(true)
  })

  it('existing createSchedule still works with random IDs (no regression)', async () => {
    // createSchedule uses nanoId(21) — random, non-deterministic IDs
    const id1 = await scheduler.createSchedule(
      TENANT,
      'legacy-job-a',
      '0 12 * * *',
    )
    const id2 = await scheduler.createSchedule(
      TENANT,
      'legacy-job-b',
      '0 18 * * *',
    )

    // Random IDs should be 21 characters (nanoId length)
    expect(id1).toHaveLength(21)
    expect(id2).toHaveLength(21)
    expect(id1).not.toBe(id2)

    // Both schedules should exist and be active
    const schedules = await scheduler.listSchedules(TENANT)
    expect(schedules).toHaveLength(2)
    expect(schedules.map(s => s.workflowName).sort()).toEqual([
      'legacy-job-a',
      'legacy-job-b',
    ])

    // Verify they have different IDs from what upsertSchedule would produce
    expect(id1).not.toBe(`sched:${TENANT}:legacy-job-a`)
    expect(id2).not.toBe(`sched:${TENANT}:legacy-job-b`)
  })
})

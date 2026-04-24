// npx vitest run src/__tests__/engine/scheduler.spec.ts
//
// Integration tests for SchedulerService — real Postgres, real EventIngestionService.
// Tests cron scheduling, idempotency, tick lifecycle, and trigger-to-workflow flow.
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { SchedulerService } from '../../scheduler/SchedulerService.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

function createMockConnector() {
  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
  return {
    connector: {
      queue: async (params: any) => {
        queuedJobs.push({
          taskName: params.taskName,
          taskBody: params.taskBody,
        })
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
      },
      getStatus: async () => ({
        id: '',
        name: '',
        status: 'QUEUED' as const,
        output: '',
        attempts: 0,
        created: '',
        nextRun: null,
        nextRunMinutes: null,
        payload: {},
      }),
      forTenant: () => null as any,
    } as any,
    queuedJobs,
  }
}

describe('SchedulerService', () => {
  let db: TestDb
  let eventIngestion: EventIngestionService
  let scheduler: SchedulerService

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
      tenantId: 'test-tenant',
    })
  })

  describe('createSchedule', () => {
    it('computes correct nextRunAtEpochMs in the future', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'daily-report',
        '0 9 * * *',
      )
      expect(id).toBeTruthy()
      expect(id.length).toBe(21) // nanoId

      const schedules = await scheduler.listSchedules('test-tenant')
      expect(schedules).toHaveLength(1)
      expect(schedules[0].workflowName).toBe('daily-report')
      expect(schedules[0].cronExpression).toBe('0 9 * * *')
      expect(schedules[0].active).toBe(true)
      expect(schedules[0].lastRunAtEpochMs).toBeNull()

      const nextRun = new Date(Number(schedules[0].nextRunAtEpochMs))
      expect(nextRun.getTime()).toBeGreaterThan(Date.now() - 1000)
    })

    it('creates multiple schedules for different workflows', async () => {
      await scheduler.createSchedule('test-tenant', 'wf-a', '*/5 * * * *')
      await scheduler.createSchedule('test-tenant', 'wf-b', '0 * * * *')

      const schedules = await scheduler.listSchedules('test-tenant')
      expect(schedules).toHaveLength(2)
      expect(schedules.map(s => s.workflowName).sort()).toEqual([
        'wf-a',
        'wf-b',
      ])
    })
  })

  describe('tick()', () => {
    it('emits cron.trigger event for due schedule and verifies DB state', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )

      // Force nextRunAtEpochMs to the past so it's immediately due
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime() })
        .where('id', '=', id)
        .execute()

      const emitted = await scheduler.tick()
      expect(emitted).toBe(1)

      // Verify the event was created in workflow_events table
      const events = await db
        .selectFrom('workflow_events')
        .selectAll()
        .where('eventType', '=', 'cron.trigger')
        .execute()
      expect(events).toHaveLength(1)
      expect(events[0].source).toBe('scheduler')
      expect(events[0].status).toBe('pending')

      const payload = JSON.parse(events[0].payload!)
      expect(payload.workflowName).toBe('test-wf')
      expect(payload.scheduleId).toBe(id)
      expect(payload.scheduledAt).toBe('2020-01-01T00:00:00.000Z')

      // Verify idempotency key format (epoch ms)
      expect(events[0].idempotencyKey).toBe(
        `cron:test-wf:${new Date('2020-01-01T00:00:00Z').getTime()}`,
      )
    })

    it('does not re-trigger for same scheduledAt (idempotency)', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const pastEpochMs = pastDate.getTime()
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: pastEpochMs })
        .where('id', '=', id)
        .execute()

      // First tick emits
      expect(await scheduler.tick()).toBe(1)

      // Reset nextRunAtEpochMs to same past time (simulating a stuck schedule)
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: pastEpochMs })
        .where('id', '=', id)
        .execute()

      // Second tick — same idempotency key, should not emit
      expect(await scheduler.tick()).toBe(0)

      // Only one event in DB
      const events = await db
        .selectFrom('workflow_events')
        .selectAll()
        .where('eventType', '=', 'cron.trigger')
        .execute()
      expect(events).toHaveLength(1)
    })

    it('advances nextRunAtEpochMs after trigger', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )
      const pastDate = new Date('2020-01-01T00:00:00Z')
      const pastEpochMs = pastDate.getTime()
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: pastEpochMs })
        .where('id', '=', id)
        .execute()

      await scheduler.tick()

      const schedule = await db
        .selectFrom('workflow_schedules')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()

      const nextRun = new Date(Number(schedule.nextRunAtEpochMs))
      expect(nextRun.getTime()).toBeGreaterThan(pastDate.getTime())
      // For */5, next after 2020-01-01T00:00:00 should be 2020-01-01T00:05:00
      expect(nextRun.toISOString()).toBe('2020-01-01T00:05:00.000Z')

      // lastRunAtEpochMs should be updated to the past date
      expect(new Date(Number(schedule.lastRunAtEpochMs!)).toISOString()).toBe(
        '2020-01-01T00:00:00.000Z',
      )
    })

    it('skips inactive schedules', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )
      await db
        .updateTable('workflow_schedules')
        .set({
          nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime(),
          active: false,
        })
        .where('id', '=', id)
        .execute()

      expect(await scheduler.tick()).toBe(0)

      const events = await db
        .selectFrom('workflow_events')
        .selectAll()
        .where('eventType', '=', 'cron.trigger')
        .execute()
      expect(events).toHaveLength(0)
    })

    // ── Multi-pod safety ────────────────────────────────────────────────
    it(
      'CRITICAL: parallel ticks across pods do not double-fire — exactly one cron.trigger per due schedule',
      { retry: 2, timeout: 15_000 },
      async () => {
        // Simulates 4 sodium pods each running their own SchedulerService instance
        // against the same DB. They all poll roughly at the same time. Without
        // proper locking + idempotency, all 4 would fire the same workflow.
        const id = await scheduler.createSchedule(
          'test-tenant',
          'multi-pod-wf',
          '*/5 * * * *',
        )
        await db
          .updateTable('workflow_schedules')
          .set({ nextRunAtEpochMs: new Date('2020-06-01T00:00:00Z').getTime() })
          .where('id', '=', id)
          .execute()

        // Build 4 independent scheduler instances — each has its own DI but
        // shares the same db + eventIngestion. Mirrors N pods on Cloud Run.
        const pods = Array.from(
          { length: 4 },
          () =>
            new SchedulerService({
              db,
              eventIngestion,
              tenantId: 'test-tenant',
            }),
        )

        // Fire all 4 ticks in parallel — worst-case race
        const counts = await Promise.all(pods.map(p => p.tick()))

        // EXACTLY ONE pod must report emitted=1; the rest report 0 (either
        // their FOR UPDATE SKIP LOCKED skipped the row, or their idempotency
        // ingest returned duplicate=true).
        const totalEmitted = counts.reduce((a, b) => a + b, 0)
        expect(totalEmitted).toBe(1)

        // And exactly ONE row in workflow_events
        const events = await db
          .selectFrom('workflow_events')
          .selectAll()
          .where('eventType', '=', 'cron.trigger')
          .where(
            'idempotencyKey',
            '=',
            `cron:multi-pod-wf:${new Date('2020-06-01T00:00:00Z').getTime()}`,
          )
          .execute()
        expect(events).toHaveLength(1)

        // nextRunAtEpochMs advanced exactly once (all UPDATEs converge to the same value)
        const sched = await db
          .selectFrom('workflow_schedules')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirstOrThrow()
        expect(Number(sched.lastRunAtEpochMs)).toEqual(
          new Date('2020-06-01T00:00:00Z').getTime(),
        )
      },
    )

    it('does not process other tenants schedules (per-tenant isolation)', async () => {
      // Create a schedule for a different tenant
      const otherTenantSchedulerId = await scheduler.createSchedule(
        'OTHER-tenant',
        'other-wf',
        '*/5 * * * *',
      )
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime() })
        .where('id', '=', otherTenantSchedulerId)
        .execute()

      // scheduler is scoped to 'test-tenant', should ignore OTHER-tenant's schedule
      const emitted = await scheduler.tick()
      expect(emitted).toBe(0)

      // Confirm OTHER-tenant's schedule wasn't touched
      const sched = await db
        .selectFrom('workflow_schedules')
        .selectAll()
        .where('id', '=', otherTenantSchedulerId)
        .executeTakeFirstOrThrow()
      expect(sched.lastRunAtEpochMs).toBeNull() // never fired
    })

    it('processes multiple due schedules in a single tick', async () => {
      const id1 = await scheduler.createSchedule(
        'test-tenant',
        'wf-a',
        '*/5 * * * *',
      )
      const id2 = await scheduler.createSchedule(
        'test-tenant',
        'wf-b',
        '0 * * * *',
      )

      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime() })
        .where('id', 'in', [id1, id2])
        .execute()

      const emitted = await scheduler.tick()
      expect(emitted).toBe(2)

      const events = await db
        .selectFrom('workflow_events')
        .selectAll()
        .where('eventType', '=', 'cron.trigger')
        .execute()
      expect(events).toHaveLength(2)
      expect(
        events.map(e => JSON.parse(e.payload!).workflowName).sort(),
      ).toEqual(['wf-a', 'wf-b'])
    })
  })

  describe('deleteSchedule', () => {
    it('soft-deletes by setting active=false', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )
      await scheduler.deleteSchedule(id)

      // Not visible in listSchedules
      expect(await scheduler.listSchedules('test-tenant')).toHaveLength(0)

      // Still in DB
      const row = await db
        .selectFrom('workflow_schedules')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.active).toBe(false)
    })

    it('deleted schedule is not triggered by tick', async () => {
      const id = await scheduler.createSchedule(
        'test-tenant',
        'test-wf',
        '*/5 * * * *',
      )
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime() })
        .where('id', '=', id)
        .execute()

      await scheduler.deleteSchedule(id)
      expect(await scheduler.tick()).toBe(0)
    })
  })

  describe('scheduler → event → workflow trigger (full integration)', () => {
    it('cron.trigger event starts a workflow when subscription exists', async () => {
      const executor = new FunctionStepExecutor()
      executor.register(
        'echo',
        async (_p: StepPayload): Promise<StepResult> => {
          return { output: { scheduled: true } }
        },
      )

      // Set up EventIngestion with auto-processing enabled this time
      const ingestion = new EventIngestionService({ db })

      const { connector, queuedJobs } = createMockConnector()
      const wf = WorkflowBuilder.create('scheduled-wf')
        .trigger({ type: 'event', eventType: 'cron.trigger' })
        .step('run', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      const engine = new WorkflowEngine({
        db,
        connector,
        executors: new Map([['function', executor]]),
        workflows: new Map([[wf.name, wf]]),
        tenantId: 'test-tenant',
        disableLogBuffering: true,
        eventIngestion: ingestion,
      })

      // Create event subscription for cron.trigger → scheduled-wf
      await ingestion.subscribe('test-tenant', 'cron.trigger', 'scheduled-wf')

      // Create and trigger schedule
      const sched = new SchedulerService({
        db,
        eventIngestion: ingestion,
        tenantId: 'test-tenant',
      })
      const schedId = await sched.createSchedule(
        'test-tenant',
        'scheduled-wf',
        '*/5 * * * *',
      )
      await db
        .updateTable('workflow_schedules')
        .set({ nextRunAtEpochMs: new Date('2020-01-01T00:00:00Z').getTime() })
        .where('id', '=', schedId)
        .execute()

      const emitted = await sched.tick()
      expect(emitted).toBe(1)

      // The event should have been auto-processed, starting a workflow
      const runs = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('workflowName', '=', 'scheduled-wf')
        .execute()
      expect(runs).toHaveLength(1)
      expect(runs[0].status).toBe('RUNNING')

      // A step should have been queued
      expect(queuedJobs.length).toBeGreaterThanOrEqual(1)

      await engine.shutdown()
    })
  })
})

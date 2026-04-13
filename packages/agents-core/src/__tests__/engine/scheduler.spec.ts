// npx vitest run src/__tests__/engine/scheduler.spec.ts
//
// Integration tests for SchedulerService — real Postgres, real EventIngestionService.
// Tests cron scheduling, idempotency, tick lifecycle, and trigger-to-workflow flow.
//
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { WorkflowBuilder } from '../../workflow/WorkflowBuilder.js'
import { WorkflowEngine } from '../../engine/WorkflowEngine.js'
import { FunctionStepExecutor } from '../../steps/FunctionStepExecutor.js'
import type { Database } from '../../entities/Database.js'
import type { StepPayload, StepResult } from '../../workflow/WorkflowBuilder.types.js'
import { SchedulerService } from '../../scheduler/SchedulerService.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

function createMockConnector() {
  const queuedJobs: Array<{ taskName: string; taskBody: any }> = []
  return {
    connector: {
      queue: async (params: any) => {
        queuedJobs.push({ taskName: params.taskName, taskBody: params.taskBody })
        return { id: params.uniqueTaskName, name: params.taskName, status: 'QUEUED', output: '', attempts: 0, created: new Date().toISOString(), nextRun: null, nextRunMinutes: null }
      },
      getStatus: async () => ({ id: '', name: '', status: 'QUEUED' as const, output: '', attempts: 0, created: '', nextRun: null, nextRunMinutes: null, payload: {} }),
      forTenant: () => null as any,
    } as any,
    queuedJobs,
  }
}

describe('SchedulerService', () => {
  let db: Kysely<Database>
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
    await sql`TRUNCATE TABLE workflow_schedules CASCADE`.execute(db)

    eventIngestion = new EventIngestionService({ db, skipAutoProcess: true })
    scheduler = new SchedulerService({
      db,
      eventIngestion,
      tenantId: 'test-tenant',
    })
  })

  describe('createSchedule', () => {
    it('computes correct nextRunAt in the future', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'daily-report', '0 9 * * *')
      expect(id).toBeTruthy()
      expect(id.length).toBe(21) // nanoId

      const schedules = await scheduler.listSchedules('test-tenant')
      expect(schedules).toHaveLength(1)
      expect(schedules[0].workflowName).toBe('daily-report')
      expect(schedules[0].cronExpression).toBe('0 9 * * *')
      expect(schedules[0].active).toBe(true)
      expect(schedules[0].lastRunAt).toBeNull()

      const nextRun = new Date(schedules[0].nextRunAt)
      expect(nextRun.getTime()).toBeGreaterThan(Date.now() - 1000)
    })

    it('creates multiple schedules for different workflows', async () => {
      await scheduler.createSchedule('test-tenant', 'wf-a', '*/5 * * * *')
      await scheduler.createSchedule('test-tenant', 'wf-b', '0 * * * *')

      const schedules = await scheduler.listSchedules('test-tenant')
      expect(schedules).toHaveLength(2)
      expect(schedules.map(s => s.workflowName).sort()).toEqual(['wf-a', 'wf-b'])
    })
  })

  describe('tick()', () => {
    it('emits cron.trigger event for due schedule and verifies DB state', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')

      // Force nextRunAt to the past so it's immediately due
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: new Date('2020-01-01T00:00:00Z') })
        .where('id', '=', id)
        .execute()

      const emitted = await scheduler.tick()
      expect(emitted).toBe(1)

      // Verify the event was created in workflow_events table
      const events = await db.selectFrom('workflow_events')
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

      // Verify idempotency key format
      expect(events[0].idempotencyKey).toBe('cron:test-wf:2020-01-01T00:00:00.000Z')
    })

    it('does not re-trigger for same scheduledAt (idempotency)', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')
      const pastDate = new Date('2020-01-01T00:00:00Z')
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: pastDate })
        .where('id', '=', id)
        .execute()

      // First tick emits
      expect(await scheduler.tick()).toBe(1)

      // Reset nextRunAt to same past time (simulating a stuck schedule)
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: pastDate })
        .where('id', '=', id)
        .execute()

      // Second tick — same idempotency key, should not emit
      expect(await scheduler.tick()).toBe(0)

      // Only one event in DB
      const events = await db.selectFrom('workflow_events')
        .selectAll()
        .where('eventType', '=', 'cron.trigger')
        .execute()
      expect(events).toHaveLength(1)
    })

    it('advances nextRunAt after trigger', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')
      const pastDate = new Date('2020-01-01T00:00:00Z')
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: pastDate })
        .where('id', '=', id)
        .execute()

      await scheduler.tick()

      const schedule = await db.selectFrom('workflow_schedules')
        .selectAll().where('id', '=', id).executeTakeFirstOrThrow()

      const nextRun = new Date(schedule.nextRunAt)
      expect(nextRun.getTime()).toBeGreaterThan(pastDate.getTime())
      // For */5, next after 2020-01-01T00:00:00 should be 2020-01-01T00:05:00
      expect(nextRun.toISOString()).toBe('2020-01-01T00:05:00.000Z')

      // lastRunAt should be updated to the past date
      expect(new Date(schedule.lastRunAt!).toISOString()).toBe('2020-01-01T00:00:00.000Z')
    })

    it('skips inactive schedules', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: new Date('2020-01-01'), active: false })
        .where('id', '=', id)
        .execute()

      expect(await scheduler.tick()).toBe(0)

      const events = await db.selectFrom('workflow_events')
        .selectAll().where('eventType', '=', 'cron.trigger').execute()
      expect(events).toHaveLength(0)
    })

    it('processes multiple due schedules in a single tick', async () => {
      const id1 = await scheduler.createSchedule('test-tenant', 'wf-a', '*/5 * * * *')
      const id2 = await scheduler.createSchedule('test-tenant', 'wf-b', '0 * * * *')

      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: new Date('2020-01-01') })
        .where('id', 'in', [id1, id2])
        .execute()

      const emitted = await scheduler.tick()
      expect(emitted).toBe(2)

      const events = await db.selectFrom('workflow_events')
        .selectAll().where('eventType', '=', 'cron.trigger').execute()
      expect(events).toHaveLength(2)
      expect(events.map(e => JSON.parse(e.payload!).workflowName).sort()).toEqual(['wf-a', 'wf-b'])
    })
  })

  describe('deleteSchedule', () => {
    it('soft-deletes by setting active=false', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')
      await scheduler.deleteSchedule(id)

      // Not visible in listSchedules
      expect(await scheduler.listSchedules('test-tenant')).toHaveLength(0)

      // Still in DB
      const row = await db.selectFrom('workflow_schedules')
        .selectAll().where('id', '=', id).executeTakeFirstOrThrow()
      expect(row.active).toBe(false)
    })

    it('deleted schedule is not triggered by tick', async () => {
      const id = await scheduler.createSchedule('test-tenant', 'test-wf', '*/5 * * * *')
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: new Date('2020-01-01') })
        .where('id', '=', id)
        .execute()

      await scheduler.deleteSchedule(id)
      expect(await scheduler.tick()).toBe(0)
    })
  })

  describe('scheduler → event → workflow trigger (full integration)', () => {
    it('cron.trigger event starts a workflow when subscription exists', async () => {
      const executor = new FunctionStepExecutor()
      executor.register('echo', async (p: StepPayload): Promise<StepResult> => {
        return { output: { scheduled: true } }
      })

      // Set up EventIngestion with auto-processing enabled this time
      const ingestion = new EventIngestionService({ db })

      const { connector, queuedJobs } = createMockConnector()
      const wf = WorkflowBuilder.create('scheduled-wf')
        .trigger({ type: 'event', eventType: 'cron.trigger' })
        .step('run', { executorType: 'function', executorConfig: { handler: 'echo' } })
        .build()

      const engine = new WorkflowEngine({
        db, connector,
        executors: new Map([['function', executor]]),
        workflows: new Map([[wf.name, wf]]),
        tenantId: 'test-tenant',
        disableLogBuffering: true,
        eventIngestion: ingestion,
      })

      // Create event subscription for cron.trigger → scheduled-wf
      await ingestion.subscribe('test-tenant', 'cron.trigger', 'scheduled-wf')

      // Create and trigger schedule
      const sched = new SchedulerService({ db, eventIngestion: ingestion, tenantId: 'test-tenant' })
      const schedId = await sched.createSchedule('test-tenant', 'scheduled-wf', '*/5 * * * *')
      await db.updateTable('workflow_schedules')
        .set({ nextRunAt: new Date('2020-01-01') })
        .where('id', '=', schedId)
        .execute()

      const emitted = await sched.tick()
      expect(emitted).toBe(1)

      // The event should have been auto-processed, starting a workflow
      const runs = await db.selectFrom('workflow_runs')
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

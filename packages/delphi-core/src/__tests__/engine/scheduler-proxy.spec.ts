// npx vitest run src/__tests__/engine/scheduler-proxy.spec.ts
//
// Tests for engine.<workflow>.schedule() / unschedule() / listSchedules()
// — the integrated cron scheduling API via the typed proxy.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { createEngine } from '../../workflow/createEngine.js'
import { FunctionStep } from '../../workflow/Step.js'
import { step, Workflow } from '../../workflow/Workflow.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

// Step + Workflow using the new single-generic pattern
class NoopStep extends FunctionStep<{ x?: number }, { ok: boolean }> {
  stepName = 'noop' as const
  async handle() {
    return { output: { ok: true } }
  }
}

class SchedulableWorkflow extends Workflow<{ x?: number }> {
  workflowName = 'schedulable' as const
  steps = [step(new NoopStep())] as const
}

class OtherWorkflow extends Workflow<{ y?: string }> {
  workflowName = 'other_wf' as const
  steps = [step(new NoopStep())] as const
}

describe('engine.<workflow>.schedule() integration', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
  })

  function makeEngine() {
    return createEngine({
      database: db as any,
      workflows: [SchedulableWorkflow, OtherWorkflow] as const,
      tenantId: 'sched-tenant',
    })
  }

  it('schedule() creates a cron schedule and returns an ID', async () => {
    const engine = makeEngine()

    const scheduleId = await engine.schedulable.schedule({
      cron: '*/5 * * * *',
    })

    expect(scheduleId).toBeDefined()
    expect(typeof scheduleId).toBe('string')
    expect(scheduleId.length).toBeGreaterThan(0)
  })

  it('listSchedules() returns active schedules for the workflow', async () => {
    const engine = makeEngine()

    await engine.schedulable.schedule({ cron: '*/5 * * * *' })
    await engine.schedulable.schedule({ cron: '0 9 * * *' })

    const schedules = await engine.schedulable.listSchedules()

    expect(schedules).toHaveLength(2)
    expect(schedules[0].cronExpression).toBe('*/5 * * * *')
    expect(schedules[1].cronExpression).toBe('0 9 * * *')
    expect(schedules[0].nextRunAt).toBeDefined()
  })

  it('listSchedules() only returns schedules for the specific workflow', async () => {
    const engine = makeEngine()

    await engine.schedulable.schedule({ cron: '*/5 * * * *' })
    await engine.other_wf.schedule({ cron: '0 12 * * *' })

    const schedulableSchedules = await engine.schedulable.listSchedules()
    const otherSchedules = await engine.other_wf.listSchedules()

    expect(schedulableSchedules).toHaveLength(1)
    expect(schedulableSchedules[0].cronExpression).toBe('*/5 * * * *')

    expect(otherSchedules).toHaveLength(1)
    expect(otherSchedules[0].cronExpression).toBe('0 12 * * *')
  })

  it('unschedule() deactivates a schedule', async () => {
    const engine = makeEngine()

    const id = await engine.schedulable.schedule({ cron: '*/5 * * * *' })
    await engine.schedulable.unschedule(id)

    const schedules = await engine.schedulable.listSchedules()
    expect(schedules).toHaveLength(0)
  })

  it('scheduler is exposed on the engine for start/stop', () => {
    const engine = makeEngine()

    expect(engine.scheduler).toBeDefined()
    expect(typeof engine.scheduler.start).toBe('function')
    expect(typeof engine.scheduler.stop).toBe('function')
    expect(typeof engine.scheduler.tick).toBe('function')
  })

  it('scheduler.tick() fires due schedules', async () => {
    const engine = makeEngine()

    // Create a schedule with nextRunAtEpochMs in the past
    const pastEpochMs = Date.now() - 2 * 60 * 1000
    await db.query(
      `INSERT INTO workflow_schedules (id, "tenantId", "workflowName", "cronExpression", "nextRunAtEpochMs", active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'sched-1',
        'sched-tenant',
        'schedulable',
        '*/5 * * * *',
        pastEpochMs,
        true,
      ],
    )

    const emitted = await engine.scheduler.tick()
    expect(emitted).toBe(1)

    // Verify a workflow run was started (engine.start() path)
    const { rows } = await db.query(
      `SELECT * FROM workflow_runs WHERE "tenantId" = $1 AND "workflowName" = $2`,
      ['sched-tenant', 'schedulable'],
    )
    expect(rows.length).toBe(1)
  })

  it('schedule + tick + verify nextRunAtEpochMs advances and lastRunAtEpochMs is set', async () => {
    const engine = makeEngine()

    const id = await engine.schedulable.schedule({ cron: '* * * * *' }) // every minute

    // Set nextRunAtEpochMs to past
    const pastMs = Date.now() - 2 * 60 * 1000
    await db.query(
      `UPDATE workflow_schedules SET "nextRunAtEpochMs" = $1 WHERE id = $2`,
      [pastMs, id],
    )

    const oldNext = pastMs

    await engine.scheduler.tick()

    // Verify lastRunAtEpochMs was set and nextRunAtEpochMs advanced
    const { rows } = await db.query(
      `SELECT "nextRunAtEpochMs", "lastRunAtEpochMs" FROM workflow_schedules WHERE id = $1`,
      [id],
    )
    expect(rows[0]).toBeDefined()
    expect(rows[0].lastRunAtEpochMs).not.toBeNull()
    expect(Number(rows[0].nextRunAtEpochMs)).toBeGreaterThan(oldNext)
  })
})

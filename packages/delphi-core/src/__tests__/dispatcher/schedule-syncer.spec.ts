// npx vitest run src/__tests__/dispatcher/schedule-syncer.spec.ts
//
// Unit tests for ScheduleSyncer — iterates tenants, reads workflow schedule
// declarations, and upserts schedules via the engine's SchedulerService.
// No testcontainers needed; engines and callbacks are fully mocked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolvedTenantEngine } from '../../dispatcher/dispatcher.types.js'
import { ScheduleSyncer } from '../../dispatcher/ScheduleSyncer.js'

// ── Helpers ──────────────────────────────────────────────────────────

function makeMockEngine(
  workflows: Array<{
    name: string
    schedule?: {
      cron: string
      timezone?: string
      runOnInit?: boolean
      input?: unknown
      environments?: string[]
      tenants?: string[]
    }
  }> = [],
): ResolvedTenantEngine {
  return {
    connector: {} as any,
    ingestWorker: { handleJob: vi.fn() },
    stepTask: { handle: vi.fn() },
    scheduler: {
      upsertSchedule: vi.fn().mockResolvedValue('sched-id'),
    },
    getWorkflowDefinitions: () => workflows,
  }
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ScheduleSyncer', () => {
  let logger: ReturnType<typeof makeLogger>

  beforeEach(() => {
    logger = makeLogger()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('iterates all tenants from listTenants()', async () => {
    const engine = makeMockEngine()
    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['t1', 't2', 't3'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    await syncer.sync()

    expect(listTenants).toHaveBeenCalledTimes(1)
    expect(resolveTenant).toHaveBeenCalledTimes(3)
    expect(resolveTenant).toHaveBeenCalledWith('t1')
    expect(resolveTenant).toHaveBeenCalledWith('t2')
    expect(resolveTenant).toHaveBeenCalledWith('t3')
  })

  it('reads schedule from workflow definitions (1 with schedule, 1 without)', async () => {
    const engine = makeMockEngine([
      { name: 'wf_with_schedule', schedule: { cron: '0 6 * * *' } },
      { name: 'wf_without_schedule' },
    ])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['t1'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledTimes(1)
    expect(result.totalJobs).toBe(1)
  })

  it('calls upsertSchedule with correct params', async () => {
    const engine = makeMockEngine([
      {
        name: 'daily_report',
        schedule: {
          cron: '0 8 * * *',
          input: { format: 'pdf' },
        },
      },
    ])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['acme'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    await syncer.sync()

    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledWith(
      'acme',
      'daily_report',
      '0 8 * * *',
      { format: 'pdf' },
      { timezone: undefined, runOnInit: undefined },
    )
  })

  it('filters by schedule.tenants — skips workflow if tenant not in list', async () => {
    const engine = makeMockEngine([
      {
        name: 'platform_only',
        schedule: {
          cron: '0 0 * * *',
          tenants: ['platform-admin'],
        },
      },
    ])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi
      .fn()
      .mockResolvedValue(['tenant-x', 'platform-admin'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    // Should only upsert for platform-admin, not tenant-x
    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledTimes(1)
    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledWith(
      'platform-admin',
      'platform_only',
      '0 0 * * *',
      undefined,
      { timezone: undefined, runOnInit: undefined },
    )
    expect(result.totalJobs).toBe(1)
  })

  it('filters by schedule.environments — skips workflow if environment does not match', async () => {
    const engine = makeMockEngine([
      {
        name: 'prod_only',
        schedule: {
          cron: '0 3 * * *',
          environments: ['production'],
        },
      },
      {
        name: 'any_env',
        schedule: {
          cron: '*/5 * * * *',
        },
      },
    ])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['t1'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync('local')

    // prod_only should be skipped (env=local, not in ['production'])
    // any_env should be upserted (no environments filter)
    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledTimes(1)
    expect(engine.scheduler.upsertSchedule).toHaveBeenCalledWith(
      't1',
      'any_env',
      '*/5 * * * *',
      undefined,
      { timezone: undefined, runOnInit: undefined },
    )
    expect(result.totalJobs).toBe(1)
  })

  it('skips tenant on resolveTenant failure — others still processed, error logged', async () => {
    const engineGood = makeMockEngine([
      { name: 'wf_a', schedule: { cron: '0 1 * * *' } },
    ])

    const resolveTenant = vi.fn().mockImplementation(async (tid: string) => {
      if (tid === 'bad-tenant') {
        throw new Error('DB connection refused')
      }
      return engineGood
    })

    const listTenants = vi
      .fn()
      .mockResolvedValue(['good-tenant', 'bad-tenant', 'another-good'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    // 2 good tenants processed, 1 failed
    expect(result.totalJobs).toBe(2)
    expect(result.tenantCount).toBe(3)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('bad-tenant: DB connection refused'),
    )
  })

  it('returns correct totals', async () => {
    const engine = makeMockEngine([
      { name: 'wf1', schedule: { cron: '0 1 * * *' } },
      { name: 'wf2', schedule: { cron: '0 2 * * *' } },
      { name: 'wf3' }, // no schedule
    ])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['t1', 't2'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    // 2 workflows with schedule x 2 tenants = 4 total jobs
    expect(result.totalJobs).toBe(4)
    expect(result.tenantCount).toBe(2)
  })

  it('handles empty tenant list', async () => {
    const resolveTenant = vi.fn()
    const listTenants = vi.fn().mockResolvedValue([])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    expect(result.totalJobs).toBe(0)
    expect(result.tenantCount).toBe(0)
    expect(resolveTenant).not.toHaveBeenCalled()
  })

  it('handles workflows with no schedules', async () => {
    const engine = makeMockEngine([{ name: 'wf_a' }, { name: 'wf_b' }])

    const resolveTenant = vi.fn().mockResolvedValue(engine)
    const listTenants = vi.fn().mockResolvedValue(['t1'])

    const syncer = new ScheduleSyncer({
      listTenants,
      resolveTenant,
      logger,
    })
    const result = await syncer.sync()

    expect(result.totalJobs).toBe(0)
    expect(engine.scheduler.upsertSchedule).not.toHaveBeenCalled()
  })
})

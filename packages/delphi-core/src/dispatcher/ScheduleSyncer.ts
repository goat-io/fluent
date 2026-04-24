// ScheduleSyncer.ts — Cross-tenant schedule sync from workflow declarations.
//
// Replaces sodium's multiTenantScheduler.ts (~350 lines) by reading
// schedule properties declared on Workflow classes instead of a centralized
// config array.

import type { ListTenantsFn, ResolveTenantFn } from './dispatcher.types.js'

export interface ScheduleSyncerConfig {
  listTenants: ListTenantsFn
  resolveTenant: ResolveTenantFn
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export class ScheduleSyncer {
  private readonly config: ScheduleSyncerConfig

  constructor(config: ScheduleSyncerConfig) {
    this.config = config
  }

  /**
   * Iterate all tenants, resolve their engines, read workflow.schedule
   * declarations, and upsert schedules via SchedulerService.
   *
   * @param environment - Current environment name (e.g., 'prod', 'local').
   *   Workflows with schedule.environments filter are skipped if environment
   *   doesn't match. When omitted, environment filtering is skipped.
   */
  async sync(
    environment?: string,
  ): Promise<{ totalJobs: number; tenantCount: number }> {
    const tenantIds = await this.config.listTenants()
    let totalJobs = 0

    for (const tenantId of tenantIds) {
      try {
        const engine = await this.config.resolveTenant(tenantId)

        const definitions = engine.getWorkflowDefinitions?.() ?? []

        for (const wf of definitions) {
          if (!wf.schedule) {
            continue
          }

          // Filter by tenant
          if (wf.schedule.tenants && !wf.schedule.tenants.includes(tenantId)) {
            continue
          }

          // Filter by environment
          if (
            environment &&
            wf.schedule.environments &&
            !wf.schedule.environments.includes(environment)
          ) {
            continue
          }

          await engine.scheduler.upsertSchedule(
            tenantId,
            wf.name,
            wf.schedule.cron,
            (wf.schedule.input as Record<string, unknown>) ?? undefined,
            {
              timezone: wf.schedule.timezone,
              runOnInit: wf.schedule.runOnInit,
            },
          )
          totalJobs++
        }
      } catch (err) {
        this.config.logger?.error(
          `[ScheduleSyncer] Failed for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return { totalJobs, tenantCount: tenantIds.length }
  }
}

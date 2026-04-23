// DispatchHandler.ts — Express-compatible HTTP handler for cross-tenant dispatch.
//
// Responds 202 immediately (Cloud Run scaling), then asynchronously resolves
// the tenant engine and drains work via processIncomingDispatch().

import type {
  ResolvedTenantEngine,
  ResolveTenantFn,
} from './dispatcher.types.js'

const DEFAULT_QUEUE_NAMES = new Set([
  'workflow_ingest',
  'workflow_step_light',
  'workflow_step_heavy',
  'workflow_step_ai',
  'workflow_step_sandbox',
])

export interface DispatchHandlerConfig {
  resolveTenant: ResolveTenantFn
  validQueueNames?: Set<string>
  timeBudgetMs?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export function createDispatchHandler(
  config: DispatchHandlerConfig,
): (req: any, res: any) => void {
  const validQueues = config.validQueueNames ?? DEFAULT_QUEUE_NAMES
  const timeBudget = config.timeBudgetMs ?? 120_000

  return (req: any, res: any): void => {
    const tenantId = req.headers?.['x-tenant-id'] as string | undefined
    if (!tenantId) {
      res.status(400).json({ error: 'Missing X-Tenant-ID header' })
      return
    }

    // Respond 202 immediately — Cloud Run sees this as a completed request
    // and can scale based on incoming request volume.
    res.status(202).json({ accepted: true, tenantId })

    const hint = req.body as { queueName?: string; jobId?: string } | undefined

    // Fire-and-forget background processing
    void (async () => {
      let engine: ResolvedTenantEngine
      try {
        engine = await config.resolveTenant(tenantId)
      } catch (error) {
        config.logger?.error(
          `[Dispatch] Failed to resolve tenant ${tenantId}:`,
          error instanceof Error ? error.message : String(error),
        )
        return
      }

      const connector = engine.connector
      if (!connector?.processIncomingDispatch) {
        config.logger?.error(
          `[Dispatch] No processIncomingDispatch on connector for tenant=${tenantId}`,
        )
        return
      }

      try {
        const result = await connector.processIncomingDispatch({
          handleTask: async (queueName: string, data: unknown) => {
            if (queueName === 'workflow_ingest') {
              return engine.ingestWorker.handleJob(data)
            }
            if (queueName.startsWith('workflow_step_')) {
              return engine.stepTask.handle(data)
            }
            throw new Error(
              `[Dispatch] Unknown queue "${queueName}" for tenant=${tenantId}`,
            )
          },
          timeBudgetMs: timeBudget,
          validQueueNames: validQueues,
          hint: hint
            ? { tenantId, queueName: hint.queueName, jobId: hint.jobId }
            : undefined,
        })

        config.logger?.info(
          `[Dispatch] tenant=${tenantId} processed=${result.processed} failed=${result.failed}`,
        )
      } catch (error) {
        config.logger?.error('[Dispatch] Request failed', {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
}

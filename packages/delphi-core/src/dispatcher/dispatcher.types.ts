// dispatcher.types.ts — Config & callback interfaces for cross-tenant dispatch.
//
// The dispatcher is a process-level singleton (1 per backend) that coordinates
// dispatch hints across N tenant engines. delphi-core NEVER imports any DI
// framework — consumer provides tenant resolution via callbacks.

import type { TaskConnector } from '@goatlab/tasks-core'

/**
 * Consumer-provided callback to resolve a tenant engine.
 * This is the DI boundary — delphi-core never imports any DI framework.
 *
 * The returned object must expose:
 * - `connector` — TaskConnector with `processIncomingDispatch()`
 * - `ingestWorker` — with `.handleJob(data)`
 * - `stepTask` — with `.handle(data)`
 * - `scheduler` — SchedulerService for schedule sync
 * - `config.workflows` — Map of workflow definitions (for schedule sync)
 */
export type ResolveTenantFn = (
  tenantId: string,
) => Promise<ResolvedTenantEngine> | ResolvedTenantEngine

/** Minimal engine shape the dispatcher needs — avoids importing TypedEngine generics. */
export interface ResolvedTenantEngine {
  connector: TaskConnector<object>
  ingestWorker: { handleJob: (data: unknown) => Promise<unknown> }
  stepTask: { handle: (data: unknown) => Promise<unknown> }
  scheduler: {
    upsertSchedule: (
      tenantId: string,
      workflowName: string,
      cronExpression: string,
      input?: Record<string, unknown>,
      opts?: { timezone?: string; runOnInit?: boolean },
    ) => Promise<string>
  }
  /** Workflow definitions registered on this engine. */
  getWorkflowDefinitions?: () => Array<{
    name: string
    schedule?: {
      cron: string
      timezone?: string
      runOnInit?: boolean
      input?: unknown
      environments?: string[]
      tenants?: string[]
    }
  }>
}

/** Consumer-provided callback to list all active tenant IDs. */
export type ListTenantsFn = () => Promise<string[]>

export interface DispatcherConfig {
  /**
   * Redis connection for hint transport (BullMQ dispatch-hints queue).
   * Provide this OR `database`, not both.
   */
  redis?: { host: string; port: number; [key: string]: unknown } | unknown

  /**
   * Platform Postgres pool for hint transport (alternative to Redis).
   * Uses `dispatch_hints` table + LISTEN/NOTIFY.
   * Provide this OR `redis`, not both.
   */
  database?: import('../db/DbClient.js').DbClient

  /**
   * URL where dispatch HTTP endpoint is reachable.
   * The hint listener POSTs here. Use external URL for Cloud Run scaling.
   * Example: 'https://api.myapp.com/dispatch/worker'
   */
  dispatchUrl: string

  /** Resolve a tenant ID to its engine. Called on every dispatch request. */
  resolveTenant: ResolveTenantFn

  /** List all active tenant IDs. Used by syncSchedules(). */
  listTenants: ListTenantsFn

  /** Prefix for dispatch hint queue keys. Default: 'dispatch' */
  dispatchPrefix?: string

  /**
   * Valid queue names for dispatch routing.
   * Default: workflow_ingest, workflow_step_light, workflow_step_heavy,
   *          workflow_step_ai, workflow_step_sandbox
   */
  validQueueNames?: Set<string>

  /**
   * Optional context wrapper for step execution. When provided, the entire
   * dispatch processing (resolve + step execution) runs inside this wrapper.
   *
   * Use this when your DI framework requires AsyncLocalStorage or similar
   * scoping — e.g., `wrapExecution: (tenantId, fn) => withContainer(fn, tenantId)`.
   *
   * When omitted, steps run in the same context as the HTTP handler.
   */
  wrapExecution?: (
    tenantId: string,
    fn: () => Promise<{ processed: number; failed: number }>,
  ) => Promise<{ processed: number; failed: number }>

  /** Time budget for processing a dispatch batch (ms). Default: 120_000 */
  timeBudgetMs?: number

  /** BullMQ job options for dispatch hints. */
  hintJobOptions?: Record<string, unknown>

  /** Optional logger. */
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

/** The dispatcher singleton returned by createDispatcher(). */
export interface Dispatcher {
  /**
   * Start the dispatch listener. Call AFTER HTTP server is accepting connections.
   * In Redis mode: starts BullMQ Worker on dispatch-hints queue.
   * In PG mode: starts LISTEN/NOTIFY + polling on platform DB.
   */
  start(): Promise<void>

  /** Stop the listener and clean up all resources. */
  stop(): Promise<void>

  /** Whether the dispatch listener is currently running. */
  isRunning(): boolean

  /**
   * Express/Connect-compatible request handler.
   * Mount as: `app.post('/dispatch/worker', dispatcher.handler)`
   *
   * Flow: extracts X-Tenant-ID → 202 immediately → resolveTenant →
   * processIncomingDispatch → route to ingestWorker/stepTask.
   */
  handler: (req: any, res: any) => void

  /**
   * Fire a dispatch hint. Wired as onAfterQueue on per-tenant connectors.
   * Non-throwing: logs errors but never rejects.
   */
  fireHint(params: {
    tenantId: string
    queueName: string
    jobId: string
    priority?: number
  }): Promise<void>

  /**
   * Sync schedules across all tenants by reading workflow.schedule declarations.
   * Iterates listTenants(), resolves each engine, upserts schedules.
   */
  syncSchedules(
    environment?: string,
  ): Promise<{ totalJobs: number; tenantCount: number }>
}

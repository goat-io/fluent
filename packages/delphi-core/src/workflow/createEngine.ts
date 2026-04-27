// createEngine.ts — typed engine factory + per-workflow proxy.
//
// Wraps WorkflowEngine + IngestBuffer construction so each registered
// workflow becomes an addressable, fully-typed property on the returned
// object: `engine.payment_critical.startCommitted({...})` instead of
// `engine.start({ workflowName: 'payment_critical', input: {...} })`.
//
// No string handler keys at the call site, no JsonObject blobs — the
// workflow's TInput generic flows straight into the start() argument.
//
// Companion: ./Step.ts, ./Workflow.ts.
//
// npx vitest run src/__tests__/workflow.spec.ts

import type {
  JsonObject,
  SnakeToCamelCase,
  TaskConnector,
} from '@goatlab/tasks-core'
import { ShouldQueue, snakeToCamelCase } from '@goatlab/tasks-core'
import type { Pool } from 'pg'
import { AgentRegistry } from '../broker/AgentRegistry.js'
import type { BrokerHandlers } from '../broker/BrokerHandlers.js'
import { createBrokerHandlers } from '../broker/BrokerHandlers.js'
import { WorkerBroker } from '../broker/WorkerBroker.js'
import type { DbClient } from '../db/DbClient.js'
import { createDbClient, createPool } from '../db/DbClient.js'
import { IngestBuffer } from '../engine/IngestBuffer.js'
import { IngestWorker } from '../engine/IngestWorker.js'
import { PgConnector } from '../engine/PgConnector.js'
import { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { WorkflowEngineConfig } from '../engine/WorkflowEngine.types.js'
import { EventIngestionService } from '../events/EventIngestion.js'
import { SchedulerService } from '../scheduler/SchedulerService.js'
import type { IANATimezone } from '../scheduler/timezones.js'
import { FunctionStepExecutor } from '../steps/FunctionStepExecutor.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import { WorkflowStepTask } from '../tasks/WorkflowStepTask.js'
import { workflowFromShouldQueue } from './fromShouldQueue.js'
import { Step } from './Step.js'
import { Workflow } from './Workflow.js'

/**
 * Optional knobs threaded into the IngestBuffer that backs `startBuffered`
 * and `startCommitted`. Defaults match what the test-server uses.
 */
export interface CreateEngineIngestOptions {
  flushThreshold?: number
  flushIntervalMs?: number
  maxJitterMs?: number
  committedFlushThreshold?: number
  committedFlushIntervalMs?: number
  committedMaxConcurrentFlushes?: number
}

/**
 * Per-workflow operations exposed by the typed proxy. Every method is
 * scoped to one workflow — input shape, signal types, and runId routing
 * all flow from the Workflow class generics.
 *
 * `TInput` is intentionally *not* constrained to `JsonObject` — sodium
 * task classes commonly declare optional fields (`foo?: T`), which
 * TypeScript surfaces as `T | undefined` and therefore don't satisfy
 * the strict `JsonObject` index signature. The BullMQ transport strips
 * absent keys anyway, so the constraint only produced noise.
 */
export interface WorkflowOps<TInput extends object> {
  /**
   * Synchronous start: writes run + steps to PG, dispatches root steps,
   * returns the runId. Use for low-volume one-off starts where you want
   * the simplest semantics.
   */
  start(
    input: TInput,
    opts?: {
      idempotencyKey?: string
      traceId?: string
      delaySeconds?: number
    },
  ): Promise<{ runId: string }>

  /**
   * Buffered ingest: trigger lands in IngestBuffer (in-memory), returns
   * runId in ~1-2ms. PG write happens downstream in IngestWorker.
   * Use for high-volume non-critical flows.
   */
  startBuffered(
    input: TInput,
    opts?: { idempotencyKey?: string; traceId?: string },
  ): { runId: string; traceId: string }

  /**
   * Committed ingest: blocks until the workflow_runs row is COPY-FROM'd
   * and COMMIT'd to PG with synchronous_commit=ON. The Workflow class
   * should also declare `durability = 'committed' as const` so this is
   * the only path that fires for it (committed-by-design).
   * Use for payments, financial flows, anything where "accepted" must
   * mean "durable on disk".
   */
  startCommitted(
    input: TInput,
    opts?: { idempotencyKey?: string; traceId?: string },
  ): Promise<{ runId: string; traceId: string }>

  /** Get full run + steps for a previously-started run. */
  getStatus(runId: string): Promise<unknown>

  /** Cancel a running workflow. */
  cancel(runId: string): Promise<void>

  /** Send a named signal to a running workflow. */
  signal(
    runId: string,
    signalName: string,
    data: Record<string, unknown>,
  ): Promise<void>

  /** Submit human input for a step in WAITING_HUMAN status. */
  submitHumanInput(
    runId: string,
    stepName: string,
    data: Record<string, unknown>,
    respondedBy?: string,
  ): Promise<void>

  /** Schedule this workflow to run on a cron expression. Returns the schedule ID. */
  schedule(opts: {
    cron: string
    input?: TInput
    timezone?: IANATimezone
    runOnInit?: boolean
  }): Promise<string>

  /** Remove a schedule by ID. */
  unschedule(scheduleId: string): Promise<void>

  /** List active schedules for this workflow. */
  listSchedules(): Promise<
    Array<{
      id: string
      cronExpression: string
      nextRunAt: string | Date
      lastRunAt: string | Date | null
    }>
  >
}

/**
 * Anything `createEngine` accepts in its `workflows` array — a Delphi
 * `Workflow` instance OR a `@goatlab/tasks-core` `ShouldQueue` instance.
 * ShouldQueue entries are auto-adapted to single-step workflows at
 * construction time, so "a task is a one-step workflow" holds at the API
 * boundary without the caller writing a wrapping call.
 */
/** A workflow class (auto-instantiated) or instance */
export type WorkflowLike =
  | Workflow<any>
  | ShouldQueue<any, any, any>
  | (new () => Workflow<any>)
  | (new () => ShouldQueue<any, any, any>)

/** Extract the input type from a WorkflowLike entry. */
type InputOf<W> = W extends new () => Workflow<infer TInput>
  ? TInput
  : W extends new () => ShouldQueue<infer TInput, any, any>
    ? TInput
    : W extends Workflow<infer TInput>
      ? TInput
      : W extends ShouldQueue<infer TInput, any, any>
        ? TInput
        : never

/**
 * Extract the literal workflow name from a WorkflowLike entry.
 * Inferred from the `workflowName` property (declared `as const`),
 * NOT from a generic parameter — no duplication needed.
 */
type NameOf<W> = W extends new () => { workflowName: infer N extends string }
  ? N
  : W extends { workflowName: infer N extends string }
    ? N
    : W extends ShouldQueue<any, any, infer TName>
      ? TName
      : never

/**
 * Mapped type — turns a tuple of workflow-likes into
 * `{ [workflowName]: WorkflowOps<input> }` AND
 * `{ [camelCase(workflowName)]: WorkflowOps<input> }`. Every workflow
 * is reachable under both its literal `taskName` (typically snake_case —
 * `process_post`) and the camelCase-transformed alias (`processPost`),
 * so migrating call sites that use either convention is a no-op.
 *
 * If a workflow name has no underscores/dashes, the two keys collapse
 * to one — no overlap, no duplicates.
 */
/** Exclude wide `string` — only keep literal string types to prevent index signature pollution. */
type LiteralOnly<T extends string> = string extends T ? never : T

/**
 * Iterate by tuple INDEX, not by `Ws[number]` union. This ensures one
 * `any` entry in the tuple doesn't collapse the entire union and wipe
 * out all workflow names/types. Each slot is evaluated independently.
 */
export type WorkflowsApi<Ws extends readonly WorkflowLike[]> = {
  [K in keyof Ws as K extends `${number}`
    ? LiteralOnly<NameOf<Ws[K]>>
    : never]: WorkflowOps<InputOf<Ws[K]>>
} & {
  [K in keyof Ws as K extends `${number}`
    ? LiteralOnly<SnakeToCamelCase<NameOf<Ws[K]> & string>>
    : never]: WorkflowOps<InputOf<Ws[K]>>
}

/**
 * Returned engine: a real `WorkflowEngine` instance + per-workflow proxy
 * properties + the underlying `ingestBuffer` (for shutdown, depth probes).
 */
/** Engine service properties — always win over workflow proxy names. */
interface EngineServices {
  ingestBuffer: IngestBuffer
  ingestWorker: IngestWorker
  stepTask: WorkflowStepTask
  scheduler: SchedulerService
  /** The underlying dispatch connector (BullMQ or PgConnector). */
  connector: import('@goatlab/tasks-core').TaskConnector<object>
  agents: {
    registry: AgentRegistry
    handlers: BrokerHandlers
    broker: WorkerBroker
  }
  shutdown: () => Promise<void>
}

export type TypedEngine<Ws extends readonly WorkflowLike[]> = WorkflowEngine &
  Omit<WorkflowsApi<Ws>, keyof EngineServices> &
  EngineServices

/**
 * Build a typed engine where every registered workflow is addressable
 * directly — no string workflow names at the call site.
 *
 * Accepts a mix of `Workflow` subclass instances AND bare
 * `@goatlab/tasks-core` `ShouldQueue` instances in the same array —
 * tasks are auto-adapted to single-step workflows internally, so the
 * call site gets the same typed proxy either way.
 *
 * @example
 *   // Postgres only (default — no Redis needed):
 *   const engine = createEngine({
 *     database: 'postgresql://user:pass@localhost:5432/mydb',
 *     workflows: [paymentWorkflow, onboardingWorkflow] as const,
 *     tenantId: 'default',
 *   })
 *
 *   // With Redis for high throughput:
 *   const engine = createEngine({
 *     database: existingPgPool,
 *     redis: existingRedisConnection,
 *     workflows: [paymentWorkflow] as const,
 *     tenantId: 'default',
 *   })
 *
 *   await engine.payment_critical.startCommitted({ orderId, amountCents, customerId })
 *   await engine.payment_critical.signal(runId, 'approved', { reviewer: 'alice' })
 */
export function createEngine<const Ws extends readonly WorkflowLike[]>(
  config: Omit<
    WorkflowEngineConfig,
    'workflows' | 'executors' | 'db' | 'pgPool'
  > & {
    /**
     * Postgres connection. Accepts:
     * - Connection string: `'postgresql://user:pass@localhost:5432/mydb'`
     * - Existing pg.Pool: share your backend's pool (no duplicate connections)
     * - Existing DbClient: for advanced scenarios
     */
    database:
      | string
      | Pool
      | DbClient
      | {
          query: (...args: any[]) => any
          connect: (...args: any[]) => any
          end: (...args: any[]) => any
        }
    workflows: Ws
    /**
     * Optional Redis connection for high-throughput dispatch.
     * When provided, step dispatch goes through Redis (via BullMQ internally).
     * When omitted, Postgres handles dispatch (~500 steps/s).
     *
     * Accepts an existing ioredis instance (shares your backend's connection)
     * or a connection config object.
     */
    redis?: { host: string; port: number; [key: string]: unknown } | unknown
    /** Extra executors keyed by `executorType` for non-function steps. */
    extraExecutors?: Map<string, StepExecutor>
    /** IngestBuffer overrides. */
    ingest?: CreateEngineIngestOptions
    /**
     * Postgres dispatch tuning (ignored when `redis` is provided).
     * Controls polling behavior in Postgres-only mode.
     */
    dispatch?: {
      /** Base polling interval in ms. Default: 500 */
      pollingIntervalMs?: number
      /** Max polling interval in ms (adaptive backoff ceiling). Default: 30_000 */
      maxPollingIntervalMs?: number
    }
    /**
     * Optional cross-tenant dispatcher (process-level singleton).
     * When provided, the engine automatically wires `onAfterQueue` to fire
     * dispatch hints through the dispatcher, and creates the BullMQ connector
     * with tenant-prefixed keys.
     *
     * Created via `createDispatcher()` in main.ts.
     */
    dispatcher?: import('../dispatcher/dispatcher.types.js').Dispatcher
  },
): TypedEngine<Ws> {
  // 0. Resolve database connection: string → Pool → DbClient.
  //    Never creates a pool if the user hands one in.
  let db: DbClient
  let pgPool: Pool
  const input = config.database
  if (typeof input === 'string') {
    // Connection string — create a new pool
    pgPool = createPool(input)
    db = createDbClient(pgPool)
  } else if ('query' in input && 'getPool' in input) {
    // Already a DbClient
    db = input as DbClient
    pgPool = db.getPool()
  } else {
    // Raw pg.Pool — wrap it, share it
    pgPool = input as Pool
    db = createDbClient(pgPool)
  }

  // 0b. Normalize: auto-instantiate classes, adapt ShouldQueues.
  //     After this pass, the rest of the function only deals with
  //     Workflow instances — simpler downstream code.
  const workflows: Workflow<any>[] = config.workflows.map(entry => {
    // Class reference → instantiate
    if (typeof entry === 'function') {
      const instance = new (entry as new () => any)()
      return instance instanceof ShouldQueue
        ? workflowFromShouldQueue(instance)
        : instance
    }
    // ShouldQueue instance → adapt
    if (entry instanceof ShouldQueue) {
      return workflowFromShouldQueue(entry as ShouldQueue<any, any, any>)
    }
    // Workflow instance → use as-is
    return entry as Workflow<any>
  })

  // 1. Compile every workflow to its engine definition.
  //    Duplicate names would silently overwrite each other in the engine's
  //    Map — fail loud here instead.
  const definitions = new Map<string, ReturnType<Workflow['toDefinition']>>()
  for (const wf of workflows) {
    if (definitions.has(wf.workflowName)) {
      throw new Error(
        `createEngine: duplicate workflow name "${wf.workflowName}"`,
      )
    }
    definitions.set(wf.workflowName, wf.toDefinition())
  }

  // 2. Auto-register each step's handle() in FunctionStepExecutor under a
  //    namespaced key — the same key Workflow.toDefinition() generates as
  //    `executorConfig.handler`. Users never call `executor.register()`.
  const functionExecutor = new FunctionStepExecutor()
  for (const wf of workflows) {
    for (const raw of wf.steps) {
      // Normalize: class → instance → StepEntry
      const entry =
        typeof raw === 'function'
          ? { step: new (raw as new () => any)() }
          : raw instanceof Step
            ? { step: raw }
            : raw
      const key = `${wf.workflowName}.${entry.step.stepName}`
      functionExecutor.register(key, async (payload, ctx) => {
        return entry.step.handle(payload.input as JsonObject, ctx as any) as any
      })
    }
  }

  // 2b. Auto-register rollback handlers for steps that define rollback().
  const rollbackHandlers = new Map<
    string,
    (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>
  >()
  for (const wf of workflows) {
    for (const raw of wf.steps) {
      const entry =
        typeof raw === 'function'
          ? { step: new (raw as new () => any)() }
          : raw instanceof Step
            ? { step: raw }
            : raw
      if (entry.step.rollback) {
        const key = `${wf.workflowName}.${entry.step.stepName}`
        const stepInstance = entry.step
        rollbackHandlers.set(key, async (input, output) => {
          await stepInstance.rollback!(input as any, output as any, {} as any)
        })
      }
    }
  }

  // 3. Resolve dispatch: redis > postgres-only (default).
  //    BullMQ is loaded dynamically so it stays an optional dependency.
  //    When a dispatcher is provided, onAfterQueue is wired to fire hints.
  let connector: TaskConnector<object>
  const dispatcherRef = config.dispatcher
  if (config.redis) {
    try {
      const { BullMQConnector } = require('@goatlab/tasks-adapter-bullmq')
      const bullmqOpts: Record<string, unknown> = {
        connection: config.redis,
      }
      // Always use tenant-prefixed keys when tenantId is provided —
      // Redis ACL scopes keys per tenant, so bare `bull:` prefix is denied.
      if (config.tenantId) {
        bullmqOpts.prefix = `{tenant:${config.tenantId}:bull}`
        bullmqOpts.tenantId = config.tenantId
      }
      // When dispatcher is present, wire onAfterQueue to fire cross-tenant hints
      if (dispatcherRef && config.tenantId) {
        bullmqOpts.onAfterQueue = async (params: {
          queueName: string
          jobId: string
        }) => {
          await dispatcherRef.fireHint({
            tenantId: config.tenantId!,
            queueName: params.queueName,
            jobId: params.jobId.replaceAll(':', '_'),
          })
        }
      }
      connector = new BullMQConnector(bullmqOpts)
    } catch {
      throw new Error(
        'createEngine: `redis` was provided but @goatlab/tasks-adapter-bullmq is not installed. ' +
          'Install it with: pnpm add @goatlab/tasks-adapter-bullmq',
      )
    }
  } else {
    connector = new PgConnector({
      db,
      pgPool,
      pollingIntervalMs: config.dispatch?.pollingIntervalMs,
      maxPollingIntervalMs: config.dispatch?.maxPollingIntervalMs,
      tenantId: config.tenantId,
      // When dispatcher is present, fire hints after step inserts
      onAfterQueue:
        dispatcherRef && config.tenantId
          ? params => {
              void dispatcherRef.fireHint({
                tenantId: config.tenantId!,
                queueName: params.queueName,
                jobId: params.jobId.replaceAll(':', '_'),
              })
            }
          : undefined,
    })
  }

  // 4. Build the engine.
  const executors = new Map<string, StepExecutor>([
    ['function', functionExecutor],
  ])
  if (config.extraExecutors) {
    for (const [k, v] of config.extraExecutors) {
      executors.set(k, v)
    }
  }
  const {
    database: _database,
    redis: _redis,
    dispatch: _dispatch,
    dispatcher: _dispatcher,
    ...restConfig
  } = config as any
  const engine = new WorkflowEngine({
    ...restConfig,
    db,
    pgPool,
    connector,
    workflows: definitions,
    executors,
    rollbackHandlers: rollbackHandlers.size > 0 ? rollbackHandlers : undefined,
  })

  // 5. Build the IngestBuffer — required for startBuffered / startCommitted.
  const ingestBuffer = new IngestBuffer({
    connector,
    taskName: 'workflow_ingest',
    engine,
    flushThreshold: config.ingest?.flushThreshold ?? 200,
    flushIntervalMs: config.ingest?.flushIntervalMs ?? 50,
    maxJitterMs: config.ingest?.maxJitterMs ?? 20,
    committedFlushThreshold: config.ingest?.committedFlushThreshold ?? 100,
    committedFlushIntervalMs: config.ingest?.committedFlushIntervalMs ?? 20,
    committedMaxConcurrentFlushes:
      config.ingest?.committedMaxConcurrentFlushes ?? 4,
  })

  // 6. Build the SchedulerService — shared across all workflows.
  const eventIngestion =
    (config as any).eventIngestion ?? new EventIngestionService({ db })
  eventIngestion.setEngine?.(engine)
  const scheduler = new SchedulerService({
    db,
    eventIngestion,
    engine,
    tenantId: config.tenantId,
    pollIntervalMs: 60_000,
  })

  // 7. Mount per-workflow proxy properties on the engine.
  //    Refuse names that would shadow real engine methods — payment flows
  //    rarely want to be called "start", but better to fail at construction
  //    than to silently break engine.start() for everyone.
  const reservedNames = new Set<string>([
    ...Object.getOwnPropertyNames(WorkflowEngine.prototype),
    'ingestBuffer',
    'config',
  ])
  const tenantId = config.tenantId

  // Tracks which property keys we've already mounted (across both the
  // raw workflowName alias and the camelCase alias) so we can fail
  // loud on collisions like `foo_bar` + `fooBar` landing on the same
  // `fooBar` property.
  const mountedKeys = new Map<string, string>()

  for (const wf of workflows) {
    if (reservedNames.has(wf.workflowName)) {
      throw new Error(
        `createEngine: workflow name "${wf.workflowName}" collides with a WorkflowEngine ` +
          `method or property. Pick a different name (use a noun like "process_payment", ` +
          `not a verb like "start").`,
      )
    }

    const ops: WorkflowOps<JsonObject> = {
      start: async (input, opts) =>
        engine.start({
          workflowName: wf.workflowName,
          tenantId,
          input,
          idempotencyKey: opts?.idempotencyKey,
          traceId: opts?.traceId,
          delaySeconds: opts?.delaySeconds,
        }),
      startBuffered: (input, opts) =>
        ingestBuffer.enqueue({
          workflowName: wf.workflowName,
          tenantId,
          input,
          idempotencyKey: opts?.idempotencyKey,
          traceId: opts?.traceId,
        }),
      startCommitted: async (input, opts) =>
        ingestBuffer.enqueueCommitted({
          workflowName: wf.workflowName,
          tenantId,
          input,
          idempotencyKey: opts?.idempotencyKey,
          traceId: opts?.traceId,
        }),
      getStatus: runId => engine.getStatus(runId, tenantId),
      cancel: runId => engine.cancel(runId, tenantId),
      signal: (runId, signalName, data) =>
        engine.signal(runId, tenantId, signalName, data),
      submitHumanInput: (runId, stepName, data, respondedBy) =>
        engine.submitHumanInput({
          workflowRunId: runId,
          stepName,
          tenantId,
          data: data as JsonObject,
          respondedBy,
        }),
      schedule: opts =>
        scheduler.createSchedule(
          tenantId,
          wf.workflowName,
          opts.cron,
          opts.input as Record<string, unknown> | undefined,
          { timezone: opts.timezone, runOnInit: opts.runOnInit },
        ),
      unschedule: scheduleId => scheduler.deleteSchedule(scheduleId),
      listSchedules: async () => {
        const all = await scheduler.listSchedules(tenantId)
        return all
          .filter(s => s.workflowName === wf.workflowName)
          .map(s => ({
            id: s.id,
            cronExpression: s.cronExpression,
            nextRunAt: new Date(Number(s.nextRunAtEpochMs)).toISOString(),
            lastRunAt: s.lastRunAtEpochMs
              ? new Date(Number(s.lastRunAtEpochMs)).toISOString()
              : null,
          }))
      },
    }
    // Mount under the raw workflow name AND its camelCase alias so
    // call sites can use either convention freely:
    //   engine.process_post.start({...})  // raw taskName
    //   engine.processPost.start({...})   // camelCase alias
    // If the raw name already is camelCase (no `_` / `-`), the two
    // keys collapse to one and we only mount once.
    const camelAlias = snakeToCamelCase(wf.workflowName)
    const aliasKeys =
      camelAlias === wf.workflowName
        ? [wf.workflowName]
        : [wf.workflowName, camelAlias]

    for (const key of aliasKeys) {
      const existing = mountedKeys.get(key)
      if (existing && existing !== wf.workflowName) {
        throw new Error(
          `createEngine: workflow name collision — "${wf.workflowName}" and ` +
            `"${existing}" both resolve to property "${key}" (snake+camel aliases ` +
            `overlap). Rename one of them.`,
        )
      }
      if (reservedNames.has(key)) {
        throw new Error(
          `createEngine: camelCase alias "${key}" (from "${wf.workflowName}") ` +
            `collides with a WorkflowEngine method or property.`,
        )
      }
      mountedKeys.set(key, wf.workflowName)
      ;(engine as unknown as Record<string, unknown>)[key] = ops
    }
  }

  // 8. Build IngestWorker — drains buffered triggers into PG via COPY FROM.
  const ingestWorker = new IngestWorker({
    engine,
    flushThreshold: config.ingest?.flushThreshold ?? 200,
    flushIntervalMs: config.ingest?.flushIntervalMs ?? 20,
    maxConcurrentFlushes: config.ingest?.committedMaxConcurrentFlushes ?? 8,
    logger: (config as any).logger,
  })

  // 9. Build WorkflowStepTask — bridges dispatch → engine step execution.
  const stepTask = new WorkflowStepTask(engine)
  if (connector) {
    stepTask.setConnector(connector)
  }

  // 10. Build agent broker (registry + handlers + worker broker).
  const agentRegistry = new AgentRegistry({
    maxPendingJobs: 1000,
    sweepIntervalMs: 10_000,
    agentStaleAfterMs: 90_000,
    defaultJobTimeoutMs: 60 * 60 * 1000,
  })
  const brokerHandlers = createBrokerHandlers({
    db,
    registry: agentRegistry,
    logger: (config as any).logger,
  })
  const workerBroker = new WorkerBroker({ engine, registry: agentRegistry })

  // 11. Unified shutdown — closes ALL resources including the connector.
  const shutdown = async () => {
    scheduler.stop()
    agentRegistry.stopSweep()
    await workerBroker.stop().catch(() => {})
    await ingestBuffer.shutdown().catch(() => {})
    await engine.shutdown().catch(() => {})
    // Close the dispatch connector (BullMQ closes ioredis connections,
    // PgConnector is a no-op). Without this, Redis connections leak.
    await (connector as any)?.close?.().catch(() => {})
  }

  // Mount services on the engine proxy.
  const proxy = engine as unknown as Record<string, unknown>
  proxy.ingestBuffer = ingestBuffer
  proxy.ingestWorker = ingestWorker
  proxy.stepTask = stepTask
  proxy.scheduler = scheduler
  proxy.agents = {
    registry: agentRegistry,
    handlers: brokerHandlers,
    broker: workerBroker,
  }
  proxy.connector = connector
  proxy.getWorkflowDefinitions = () => [...definitions.values()]
  proxy.shutdown = shutdown

  return engine as TypedEngine<Ws>
}

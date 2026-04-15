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

import type { JsonObject, SnakeToCamelCase } from '@goatlab/tasks-core'
import { ShouldQueue, snakeToCamelCase } from '@goatlab/tasks-core'
import { IngestBuffer } from '../engine/IngestBuffer.js'
import { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { WorkflowEngineConfig } from '../engine/WorkflowEngine.types.js'
import { FunctionStepExecutor } from '../steps/FunctionStepExecutor.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import { workflowFromShouldQueue } from './fromShouldQueue.js'
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
    opts?: { idempotencyKey?: string; traceId?: string },
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
}

/**
 * Anything `createEngine` accepts in its `workflows` array — a Delphi
 * `Workflow` instance OR a `@goatlab/tasks-core` `ShouldQueue` instance.
 * ShouldQueue entries are auto-adapted to single-step workflows at
 * construction time, so "a task is a one-step workflow" holds at the API
 * boundary without the caller writing a wrapping call.
 */
export type WorkflowLike = Workflow<any, any> | ShouldQueue<any, any, any>

/**
 * Extract the input type from a WorkflowLike entry.
 *
 * Historically this intersected the ShouldQueue input with `JsonObject`,
 * but that made sensible task input shapes (ones with optional fields
 * typed as `T | undefined`) unassignable — `JsonObject` excludes
 * `undefined`. The BullMQ transport already serializes missing keys as
 * absent, so the constraint was cosmetic. We now pass TInput straight
 * through.
 */
type InputOf<W> = W extends Workflow<infer TInput, any>
  ? TInput
  : W extends ShouldQueue<infer TInput, any, any>
    ? TInput
    : never

/** Extract the literal-name type from a WorkflowLike entry. */
type NameOf<W> = W extends Workflow<any, infer TName>
  ? TName
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
export type WorkflowsApi<Ws extends readonly WorkflowLike[]> = {
  [W in Ws[number] as NameOf<W>]: WorkflowOps<InputOf<W>>
} & {
  [W in Ws[number] as SnakeToCamelCase<NameOf<W> & string>]: WorkflowOps<
    InputOf<W>
  >
}

/**
 * Returned engine: a real `WorkflowEngine` instance + per-workflow proxy
 * properties + the underlying `ingestBuffer` (for shutdown, depth probes).
 */
export type TypedEngine<Ws extends readonly WorkflowLike[]> = WorkflowEngine &
  WorkflowsApi<Ws> & { ingestBuffer: IngestBuffer }

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
 *   // Mix Delphi Workflows and tasks-core ShouldQueues freely:
 *   const engine = createEngine({
 *     workflows: [paymentWorkflow, checkPostTask, onboardingWorkflow] as const,
 *     db, pgPool, connector, tenantId: 'default',
 *   })
 *
 *   await engine.payment_critical.startCommitted({ orderId, amountCents, customerId })
 *   await engine.check_post.start({ postId })              // from a ShouldQueue
 *   await engine.payment_critical.signal(runId, 'approved', { reviewer: 'alice' })
 */
export function createEngine<const Ws extends readonly WorkflowLike[]>(
  config: Omit<WorkflowEngineConfig, 'workflows' | 'executors'> & {
    workflows: Ws
    /** Extra executors keyed by `executorType` for non-function steps. */
    extraExecutors?: Map<string, StepExecutor>
    /** IngestBuffer overrides. */
    ingest?: CreateEngineIngestOptions
  },
): TypedEngine<Ws> {
  // 0. Normalize: adapt any bare ShouldQueue entries into single-step
  //    Workflow instances. After this pass, the rest of the function only
  //    deals with Workflow instances — simpler downstream code.
  const workflows: Workflow<any, any>[] = config.workflows.map(entry =>
    entry instanceof ShouldQueue
      ? workflowFromShouldQueue(entry as ShouldQueue<any, any, any>)
      : (entry as Workflow<any, any>),
  )

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
    for (const entry of wf.steps) {
      const key = `${wf.workflowName}.${entry.step.stepName}`
      // Closure captures `entry` per iteration — `for..of` gives each
      // iteration its own binding so the right step instance fires.
      functionExecutor.register(key, async (payload, ctx) => {
        return entry.step.handle(payload.input as JsonObject, ctx as any) as any
      })
    }
  }

  // 3. Build the engine.
  const executors = new Map<string, StepExecutor>([
    ['function', functionExecutor],
  ])
  if (config.extraExecutors) {
    for (const [k, v] of config.extraExecutors) {
      executors.set(k, v)
    }
  }
  const engine = new WorkflowEngine({
    ...config,
    workflows: definitions,
    executors,
  })

  // 4. Build the IngestBuffer — required for startBuffered / startCommitted.
  const ingestBuffer = new IngestBuffer({
    connector: config.connector,
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

  // 5. Mount per-workflow proxy properties on the engine.
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

  ;(engine as unknown as Record<string, unknown>).ingestBuffer = ingestBuffer
  return engine as TypedEngine<Ws>
}

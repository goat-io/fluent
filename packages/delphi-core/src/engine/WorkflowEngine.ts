// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import { Ids } from '@goatlab/js-utils'

/** Escape a value for COPY FROM tab-delimited format */
function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '\\N'
  // Fast path: skip the four regex replaces when nothing needs escaping
  if (!ESC_NEEDED.test(v)) return v
  return v.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}
/**
 * Specialized escape for values that came from JSON.stringify.
 * JSON output never contains raw tab/newline/CR (those are already escaped to
 * `\\n` etc. by JSON.stringify), so we only need to double up backslashes.
 * One regex replace instead of four — ~4x faster for this common case.
 */
function escJson(v: string): string {
  return v.includes('\\') ? v.replace(/\\/g, '\\\\') : v
}
const ESC_NEEDED = /[\\\t\n\r]/
import type { JsonObject } from '@goatlab/tasks-core'
import { sql, type Kysely } from 'kysely'
import type {
  Database,
  WorkflowRun,
  WorkflowStep,
} from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import {
  HumanInputError,
  IdempotencyConflictError,
  NonRetryableError,
  WorkflowError,
  WorkflowNotFoundError,
  WorkflowRunNotFoundError,
} from '../errors/WorkflowErrors.js'
import {
  canStepTransition,
  canWorkflowTransition,
  deriveWorkflowStatus,
  getReadySteps,
} from '../state/WorkflowStateMachine.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type {
  HumanInput,
  StepContext,
  StepPayload,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowTriggerInput,
} from '../workflow/WorkflowBuilder.types.js'
import {
  ExternalActionExecutor,
  type ExternalActionRequest,
  type ExternalActionFn,
  type ExternalActionResult,
} from './ExternalActionExecutor.js'
import type { WorkflowEngineConfig, BudgetUsed, WorkflowBudget } from './WorkflowEngine.types.js'
import { TaskManager } from './TaskManager.js'
import { WriteBuffer } from './WriteBuffer.js'
import { StepStatusBuffer } from './StepStatusBuffer.js'
import type { EngineEvent } from './EngineEvent.types.js'

/** Distributive Omit — preserves discriminated union after removing `emittedAt`. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
type EmittableEvent = DistributiveOmit<EngineEvent, 'emittedAt'>

export class WorkflowEngine {
  private config: WorkflowEngineConfig
  private db: Kysely<Database>

  /**
   * The consistency layer for ALL external side effects.
   * Use `engine.externalAction()` to execute any call that modifies
   * external systems (GitHub, Linear, Slack, etc.)
   */
  readonly externalActions: ExternalActionExecutor

  /** Task manager for fan-out/fan-in task execution */
  readonly taskManager: TaskManager

  // Buffered log writer — uses the shared WriteBuffer abstraction so other
  // write paths (step status, external action results, future buffers) can
  // reuse the same flush/jitter/concurrency machinery.
  private logBuffer: WriteBuffer<{
    id: string
    stepId: string
    tenantId: string
    event: string
    data?: Record<string, unknown>
  }> | null = null

  // Note: Start buffering is handled via startBatch() for batch API.
  // Single starts use raw SQL single-round-trip optimization.

  // Cached stringified + COPY-escaped snapshots, keyed by "name@version".
  // Workflow definitions are immutable for a given version, so stringify once
  // per definition instead of per row (saves ~30–60% CPU on large batches).
  private snapshotCache: Map<string, {
    snapshot: string
    snapshotEsc: string
    // Per-step cached escapes for COPY lines (executorConfig, dependsOn)
    stepEscapes: Map<string, { executorConfigEsc: string; dependsOnEsc: string }>
  }> = new Map()

  // Per-engine constants used on every batch row — cache the escaped form once.
  // These depend only on engine config (defaultBudget), so they are stable
  // across all triggers. Lazy-initialized on first COPY FROM.
  private cachedBudgetEsc: string | null = null
  private cachedBudgetUsedEsc: string | null = null

  /**
   * Batched step-status writer. UPDATE workflow_steps via a single
   * UPDATE … FROM unnest(...) per ~100 step transitions. Per-step promise
   * resolves only after the batch commits, preserving BullMQ ack semantics.
   * null when pgPool is not configured (falls back to per-row UPDATEs).
   */
  private stepStatusBuffer: StepStatusBuffer | null = null

  /**
   * Optional Postgres schema prefix (e.g. 'agents'). When set, every Kysely
   * call goes through `db.withSchema(schema)` and raw COPY/SELECT strings
   * interpolate the prefix. Sub-services (TaskManager, ExternalActions, etc.)
   * receive the already-scoped db so their own queries get the prefix for free.
   */
  private readonly schema?: string

  /** `agents.workflow_runs` if schema set; otherwise just `workflow_runs`. */
  private q(table: string): string {
    return this.schema ? `${this.schema}.${table}` : table
  }

  /**
   * Fire an engine event AFTER its corresponding PG write has committed.
   * Synchronous from the engine's POV — never await this. Errors thrown by
   * the user's hook are caught and logged so a buggy subscriber cannot crash
   * a workflow.
   *
   * Design note: every call to this method is preceded by an `await` on the
   * appropriate buffer/SQL write. That's the contract — don't add an emit
   * call without verifying the PG write has committed first.
   */
  /**
   * Type-level distributive Omit — preserves discriminated-union narrowing
   * after stripping `emittedAt`. Without this, TS collapses the union and
   * complains about variant-specific props (e.g. `status` on RunCompletedEvent).
   */
  private emitEvent(evt: EmittableEvent): void {
    if (!this.config.onEngineEvent) return
    try {
      this.config.onEngineEvent({ ...evt, emittedAt: new Date() } as EngineEvent)
    } catch (err) {
      this.config.logger?.error?.('[Engine] onEngineEvent hook threw — swallowed', err)
    }
  }

  constructor(config: WorkflowEngineConfig) {
    this.config = config
    this.schema = config.schema
    // Wrap once at construction so all subsequent this.db.X calls inherit the schema scope
    this.db = this.schema ? config.db.withSchema(this.schema) as Kysely<Database> : config.db

    this.taskManager = new TaskManager(this.db)

    this.externalActions = new ExternalActionExecutor({
      db: this.db,
      rateLimits: config.rateLimits,
      maxConcurrentPerWorkflow: config.maxConcurrentPerWorkflow,
      rateLimiterBackend: config.rateLimiterBackend,
      logger: config.logger,
    })

    if (!config.disableLogBuffering) {
      this.logBuffer = new WriteBuffer({
        name: 'step-logs',
        flushThreshold: 50,
        flushIntervalMs: 50,
        flushFn: (batch) => this.writeLogBatch(batch),
        logger: config.logger,
      })
    }

    if (config.pgPool && !config.disableStepStatusBuffering) {
      this.stepStatusBuffer = new StepStatusBuffer({
        pgPool: config.pgPool,
        flushThreshold: 100,
        flushIntervalMs: 20,
        maxConcurrentFlushes: 4,
        schema: this.schema,
        logger: config.logger,
      })
    }

    // Wire event ingestion to this engine for trigger-based workflow starts
    if (config.eventIngestion) {
      config.eventIngestion.setEngine(this)
    }
  }

  /** Get all registered workflow definitions */
  getWorkflows(): Map<string, WorkflowDefinition> {
    return this.config.workflows
  }

  async shutdown(): Promise<void> {
    if (this.logBuffer) await this.logBuffer.shutdown()
    if (this.stepStatusBuffer) await this.stepStatusBuffer.shutdown()
  }

  // ── Start Workflow ─────────────────────────────────────────────

  async start(trigger: WorkflowTriggerInput): Promise<{ runId: string }> {
    const definition = this.config.workflows.get(trigger.workflowName)
    if (!definition) throw new WorkflowNotFoundError(trigger.workflowName)

    if (trigger.idempotencyKey) {
      const existing = await this.db
        .selectFrom('workflow_runs')
        .select('id')
        .where('idempotencyKey', '=', trigger.idempotencyKey)
        .where('tenantId', '=', trigger.tenantId)
        .executeTakeFirst()
      if (existing) {
        throw new IdempotencyConflictError(trigger.idempotencyKey, existing.id)
      }
    }

    const runId = Ids.nanoId(21)
    const now = new Date()

    // Generate traceId if not provided
    const traceId = trigger.traceId ?? Ids.nanoId(21)

    const runRow = {
      id: runId,
      tenantId: trigger.tenantId,
      workflowName: trigger.workflowName,
      workflowVersion: definition.version,
      status: 'RUNNING',
      startedAt: now,
      definitionSnapshot: toJson({
        name: definition.name,
        version: definition.version,
        defaultRetries: definition.defaultRetries,
        defaultTimeoutMs: definition.defaultTimeoutMs,
        failFast: definition.failFast,
        triggers: definition.triggers,
        steps: definition.steps.map(s => ({
          name: s.name,
          dependsOn: s.dependsOn,
          executorType: s.executorType,
          executorConfig: s.executorConfig,
          retries: s.retries,
          timeoutMs: s.timeoutMs,
          heartbeatTimeoutMs: s.heartbeatTimeoutMs,
          scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
          requiresHumanApproval: s.requiresHumanApproval,
          stepWeight: s.stepWeight,
          maxIterations: s.maxIterations,
        })),
      }),
      triggerInput: toJson(trigger.input),
      idempotencyKey: trigger.idempotencyKey ?? null,
      traceId,
      parentRunId: trigger.parentRunId ?? null,
      originEventId: trigger.originEventId ?? null,
      budget: toJson(this.config.defaultBudget ?? null),
      budgetUsed: toJson({ tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }),
      createdAt: now,
      updatedAt: now,
    }

    // Root steps get QUEUED directly (skip PENDING → QUEUED update)
    const rootNames = new Set(definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name))

    const stepRows = definition.steps.map(stepDef => {
      const isRoot = rootNames.has(stepDef.name)
      let input: JsonObject = trigger.input as JsonObject
      if (isRoot && stepDef.mapInput) input = stepDef.mapInput({})

      return {
        id: Ids.nanoId(21),
        workflowRunId: runId,
        tenantId: trigger.tenantId,
        stepName: stepDef.name,
        status: isRoot ? 'QUEUED' : 'PENDING',
        executorType: stepDef.executorType,
        executorConfig: toJson(stepDef.executorConfig),
        dependsOn: toJson(stepDef.dependsOn ?? []),
        input: isRoot ? toJson(input) : null,
        scheduledAt: isRoot ? now : null,
        attempt: 0,
        maxRetries: stepDef.retries ?? definition.defaultRetries,
        heartbeatTimeoutMs: stepDef.heartbeatTimeoutMs ?? null,
        iterationCount: 0,
        maxIterations: stepDef.maxIterations ?? null,
        createdAt: now,
        updatedAt: now,
      }
    })

    // Two Kysely inserts (run + steps) — Kysely handles parameterization safely
    await this.db.insertInto('workflow_runs').values(runRow).execute()
    if (stepRows.length > 0) {
      await this.db.insertInto('workflow_steps').values(stepRows).execute()
    }

    // PG row exists. Cache traceId and emit run.started before dispatching.
    if (this.config.onEngineEvent) {
      this.traceIdCache.set(runId, runRow.traceId)
      this.emitEvent({
        type: 'run.started',
        tenantId: trigger.tenantId, runId,
        traceId: runRow.traceId,
        workflowName: trigger.workflowName,
        workflowVersion: definition.version,
      })
    }

    // Dispatch root steps to BullMQ (rows are in DB now)
    for (const stepDef of definition.steps) {
      if (!rootNames.has(stepDef.name)) continue
      const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
      await this.dispatchStep(runId, trigger.tenantId, stepRow as any, definition)
    }

    return { runId }
  }

  /**
   * Batch start multiple workflows in a single DB transaction.
   * Hatchet pattern: batch inserts for high-throughput scenarios.
   * Use this instead of calling start() in a loop.
   */
  async startBatch(triggers: WorkflowTriggerInput[]): Promise<Array<{ runId: string }>> {
    if (triggers.length === 0) return []

    const results: Array<{ runId: string; runRow: any; stepRows: any[]; definition: WorkflowDefinition; trigger: WorkflowTriggerInput }> = []

    for (const trigger of triggers) {
      const definition = this.config.workflows.get(trigger.workflowName)
      if (!definition) throw new WorkflowNotFoundError(trigger.workflowName)

      const runId = trigger.runId ?? Ids.nanoId(21)
      const now = new Date()
      const rootNames = new Set(definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name))

      const runRow = {
        id: runId,
        tenantId: trigger.tenantId,
        workflowName: trigger.workflowName,
        workflowVersion: definition.version,
        status: 'RUNNING',
        startedAt: now,
        definitionSnapshot: toJson({
          name: definition.name, version: definition.version,
          defaultRetries: definition.defaultRetries, defaultTimeoutMs: definition.defaultTimeoutMs,
          failFast: definition.failFast, triggers: definition.triggers,
          steps: definition.steps.map(s => ({
            name: s.name, dependsOn: s.dependsOn, executorType: s.executorType,
            executorConfig: s.executorConfig, retries: s.retries, timeoutMs: s.timeoutMs,
            heartbeatTimeoutMs: s.heartbeatTimeoutMs, scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
            requiresHumanApproval: s.requiresHumanApproval, stepWeight: s.stepWeight, maxIterations: s.maxIterations,
          })),
        }),
        triggerInput: toJson(trigger.input),
        idempotencyKey: trigger.idempotencyKey ?? null,
        traceId: trigger.traceId ?? Ids.nanoId(21),
        parentRunId: trigger.parentRunId ?? null,
        originEventId: trigger.originEventId ?? null,
        budget: toJson(this.config.defaultBudget ?? null),
        budgetUsed: toJson({ tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }),
        createdAt: now, updatedAt: now,
      }

      const stepRows = definition.steps.map(stepDef => {
        const isRoot = rootNames.has(stepDef.name)
        let input: JsonObject = trigger.input as JsonObject
        if (isRoot && stepDef.mapInput) input = stepDef.mapInput({})
        return {
          id: Ids.nanoId(21), workflowRunId: runId, tenantId: trigger.tenantId,
          stepName: stepDef.name, status: isRoot ? 'QUEUED' : 'PENDING',
          executorType: stepDef.executorType, executorConfig: toJson(stepDef.executorConfig),
          dependsOn: toJson(stepDef.dependsOn ?? []), input: isRoot ? toJson(input) : null,
          scheduledAt: isRoot ? now : null, attempt: 0,
          maxRetries: stepDef.retries ?? definition.defaultRetries,
          heartbeatTimeoutMs: stepDef.heartbeatTimeoutMs ?? null,
          iterationCount: 0, maxIterations: stepDef.maxIterations ?? null,
          createdAt: now, updatedAt: now,
        }
      })

      results.push({ runId, runRow, stepRows, definition, trigger })
    }

    // Use COPY FROM if pgPool is available (Hatchet fastest path), else batch INSERT
    if (this.config.pgPool) {
      return this.startBatchCopy(triggers)
    }

    // Batch INSERT fallback
    await this.db.insertInto('workflow_runs').values(results.map(r => r.runRow)).execute()
    const allStepRows = results.flatMap(r => r.stepRows)
    if (allStepRows.length > 0) {
      await this.db.insertInto('workflow_steps').values(allStepRows).execute()
    }

    // PG rows exist — emit run.started events before dispatching root steps
    if (this.config.onEngineEvent) {
      for (const { runId, runRow, definition, trigger } of results) {
        this.traceIdCache.set(runId, runRow.traceId)
        this.emitEvent({
          type: 'run.started',
          tenantId: trigger.tenantId, runId,
          traceId: runRow.traceId,
          workflowName: trigger.workflowName,
          workflowVersion: definition.version,
        })
      }
    }

    // Dispatch root steps in bulk (one addBulk per target queue)
    const dispatchItems: Array<{ runId: string; tenantId: string; step: WorkflowStep; definition: WorkflowDefinition }> = []
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        dispatchItems.push({ runId, tenantId: trigger.tenantId, step: stepRow as any, definition })
      }
    }
    await this.dispatchStepsBulk(dispatchItems)

    return results.map(r => ({ runId: r.runId }))
  }

  /**
   * Bulk start workflows using COPY FROM (Hatchet's fastest path).
   * Requires pgPool in engine config. Falls back to startBatch() if not available.
   *
   * COPY FROM bypasses the INSERT planner and uses optimized buffer/lock handling.
   * Hatchet reports 63-92k writes/sec with this approach.
   *
   * @param opts.synchronousCommit  When true, the COPY transaction uses
   *   synchronous_commit=ON — COMMIT blocks until the WAL is fsync'd to disk.
   *   REQUIRED for workflows with durability='committed': otherwise the HTTP
   *   200 can race ahead of the actual disk flush and a crash would lose the
   *   "committed" row. Default false preserves the batched-ingest fast path
   *   (IngestWorker → COPY) where HTTP has already returned — losing a few
   *   in-flight rows is the explicit tradeoff of that path.
   *
   * @param opts.checkIdempotency  When true, pre-fetch existing rows by
   *   (tenantId, idempotencyKey) and dedupe both against PG and within the
   *   current batch (first-wins). Deduped triggers receive the original
   *   runId in the result and skip both the COPY and the step dispatch —
   *   no duplicate run, no duplicate side-effects. REQUIRED for committed
   *   payment-style flows where double-submit would charge twice. Default
   *   false preserves buffered fast-path behavior (no extra SELECT
   *   roundtrip per batch).
   */
  async startBatchCopy(
    triggers: WorkflowTriggerInput[],
    opts?: { synchronousCommit?: boolean; checkIdempotency?: boolean },
  ): Promise<Array<{ runId: string }>> {
    if (!this.config.pgPool || triggers.length === 0) {
      return this.startBatch(triggers)
    }

    // Idempotency pre-check: one SELECT per tenant collecting all existing
    // (tenantId, idempotencyKey) → runId mappings. Cheap (indexed) and runs
    // BEFORE the COPY transaction so we can short-circuit dupes entirely.
    const existingByKey = new Map<string, string>() // "tenantId|key" → runId
    if (opts?.checkIdempotency) {
      const keysByTenant = new Map<string, Set<string>>()
      for (const t of triggers) {
        if (!t.idempotencyKey) continue
        let set = keysByTenant.get(t.tenantId)
        if (!set) { set = new Set(); keysByTenant.set(t.tenantId, set) }
        set.add(t.idempotencyKey)
      }
      for (const [tenantId, keys] of keysByTenant) {
        const rows = await this.db
          .selectFrom('workflow_runs')
          .select(['id', 'idempotencyKey'])
          .where('tenantId', '=', tenantId)
          .where('idempotencyKey', 'in', [...keys])
          .execute()
        for (const r of rows) {
          if (r.idempotencyKey) existingByKey.set(`${tenantId}|${r.idempotencyKey}`, r.id)
        }
      }
    }

    // Parallel output array — index-aligned with triggers so deduped slots
    // can be filled without disturbing the COPY/dispatch order of the rest.
    const finalRunIds: string[] = new Array(triggers.length)
    const seenInBatch = new Map<string, string>() // first-wins within this flush
    const results: Array<{ runId: string; stepRows: any[]; definition: WorkflowDefinition; trigger: WorkflowTriggerInput; traceId: string }> = []
    const runLines: string[] = []
    const stepLines: string[] = []

    // Lazy-init per-engine constants — same on every row, no reason to
    // re-stringify+escape for each trigger.
    if (this.cachedBudgetEsc === null) {
      this.cachedBudgetEsc = esc(toJson(this.config.defaultBudget ?? null))
      this.cachedBudgetUsedEsc = esc(toJson({ tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }))
    }
    const budgetEsc = this.cachedBudgetEsc
    const budgetUsedEsc = this.cachedBudgetUsedEsc!

    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i]!
      const definition = this.config.workflows.get(trigger.workflowName)
      if (!definition) throw new WorkflowNotFoundError(trigger.workflowName)

      // Dedupe against PG and within-batch. First occurrence in the batch
      // wins so a flurry of identical-key retries collapses to one COPY.
      if (opts?.checkIdempotency && trigger.idempotencyKey) {
        const k = `${trigger.tenantId}|${trigger.idempotencyKey}`
        const dedupedTo = existingByKey.get(k) ?? seenInBatch.get(k)
        if (dedupedTo) {
          finalRunIds[i] = dedupedTo
          continue
        }
      }

      const runId = trigger.runId ?? Ids.nanoId(21)
      finalRunIds[i] = runId
      if (opts?.checkIdempotency && trigger.idempotencyKey) {
        seenInBatch.set(`${trigger.tenantId}|${trigger.idempotencyKey}`, runId)
      }
      const now = new Date().toISOString()
      const rootNames = new Set(definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name))

      // Reuse pre-stringified + escaped snapshot per (name, version)
      const cacheKey = `${definition.name}@${definition.version}`
      let cached = this.snapshotCache.get(cacheKey)
      if (!cached) {
        const snapshot = toJson({
          name: definition.name, version: definition.version,
          defaultRetries: definition.defaultRetries, defaultTimeoutMs: definition.defaultTimeoutMs,
          failFast: definition.failFast, triggers: definition.triggers,
          steps: definition.steps.map(s => ({
            name: s.name, dependsOn: s.dependsOn, executorType: s.executorType,
            executorConfig: s.executorConfig, retries: s.retries, timeoutMs: s.timeoutMs,
            heartbeatTimeoutMs: s.heartbeatTimeoutMs, scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
            requiresHumanApproval: s.requiresHumanApproval, stepWeight: s.stepWeight, maxIterations: s.maxIterations,
          })),
        })
        const stepEscapes = new Map<string, { executorConfigEsc: string; dependsOnEsc: string }>()
        for (const s of definition.steps) {
          stepEscapes.set(s.name, {
            executorConfigEsc: esc(toJson(s.executorConfig)),
            dependsOnEsc: esc(toJson(s.dependsOn ?? [])),
          })
        }
        cached = { snapshot, snapshotEsc: esc(snapshot), stepEscapes }
        this.snapshotCache.set(cacheKey, cached)
      }
      const snapshot = cached.snapshot
      const snapshotEsc = cached.snapshotEsc

      const triggerInput = toJson(trigger.input)
      const idempKey = trigger.idempotencyKey ?? '\\N'

      // Tab-delimited COPY line for workflow_runs
      // Columns: id, tenantId, workflowName, workflowVersion, status, definitionSnapshot,
      //   triggerInput, idempotencyKey, traceId, parentRunId, originEventId, budget, budgetUsed, startedAt, completedAt, createdAt, updatedAt
      const traceId = trigger.traceId ?? Ids.nanoId(21)
      runLines.push([
        runId, trigger.tenantId, trigger.workflowName, definition.version,
        'RUNNING', snapshotEsc, escJson(triggerInput), idempKey,
        traceId, trigger.parentRunId ?? '\\N', trigger.originEventId ?? '\\N',
        budgetEsc, budgetUsedEsc,
        now, '\\N', now, now,
      ].join('\t'))

      const localStepRows: any[] = []
      for (const stepDef of definition.steps) {
        const isRoot = rootNames.has(stepDef.name)
        let input: JsonObject = trigger.input as JsonObject
        if (isRoot && stepDef.mapInput) input = stepDef.mapInput({})

        const stepId = Ids.nanoId(21)
        const stepRow = {
          id: stepId, workflowRunId: runId, tenantId: trigger.tenantId,
          stepName: stepDef.name, status: isRoot ? 'QUEUED' : 'PENDING',
          executorType: stepDef.executorType, executorConfig: toJson(stepDef.executorConfig),
          dependsOn: toJson(stepDef.dependsOn ?? []), input: isRoot ? toJson(input) : null,
          scheduledAt: isRoot ? now : null, attempt: 0,
          maxRetries: stepDef.retries ?? definition.defaultRetries,
          heartbeatTimeoutMs: stepDef.heartbeatTimeoutMs ?? null,
          iterationCount: 0, maxIterations: stepDef.maxIterations ?? null,
        }
        localStepRows.push(stepRow)

        // Tab-delimited COPY line for workflow_steps
        // Columns: id, workflowRunId, tenantId, stepName, status, executorType, executorConfig,
        //   dependsOn, input, output, error, attempt, maxRetries, startedAt, completedAt,
        //   scheduledAt, lastHeartbeatAt, lastHeartbeatData, heartbeatTimeoutMs,
        //   humanPrompt, humanResponse, humanRespondedBy, humanRespondedAt,
        //   iterationCount, maxIterations, tokensUsed, costUsd, modelUsed, createdAt, updatedAt
        const stepEsc = cached.stepEscapes.get(stepDef.name)!
        stepLines.push([
          stepId, runId, trigger.tenantId, stepDef.name,
          isRoot ? 'QUEUED' : 'PENDING', stepDef.executorType,
          stepEsc.executorConfigEsc, stepEsc.dependsOnEsc,
          isRoot ? escJson(toJson(input)) : '\\N',  // input
          '\\N',                                 // output
          '\\N',                                 // error
          0,                                     // attempt
          stepDef.retries ?? definition.defaultRetries,  // maxRetries
          '\\N',                                 // startedAt
          '\\N',                                 // completedAt
          isRoot ? now : '\\N',                  // scheduledAt
          '\\N',                                 // lastHeartbeatAt
          '\\N',                                 // lastHeartbeatData
          stepDef.heartbeatTimeoutMs ?? '\\N',   // heartbeatTimeoutMs
          '\\N', '\\N', '\\N', '\\N',           // human fields
          0,                                     // iterationCount
          stepDef.maxIterations ?? '\\N',         // maxIterations
          '\\N', '\\N', '\\N',                   // cost fields
          now, now,                              // createdAt, updatedAt
        ].join('\t'))
      }

      results.push({ runId, stepRows: localStepRows, definition, trigger, traceId })
    }

    // Short-circuit: every trigger was deduplicated by idempotency. No new
    // rows to COPY, no new steps to dispatch — original runs already have
    // their own state machine running. Return the resolved runIds.
    if (runLines.length === 0) {
      return finalRunIds.map(id => ({ runId: id }))
    }

    // Execute COPY FROM for both tables in one atomic transaction.
    // Sequential on the same client — a Postgres session can only hold one
    // COPY stream at a time. FK from workflow_steps → workflow_runs requires
    // atomic commit of both tables, so splitting is not safe.
    const client = await this.config.pgPool.connect()
    const tBegin = performance.now()
    try {
      // Combine BEGIN + SET LOCAL into one roundtrip (saves ~15-40ms per flush
      // under the Docker VM and ~2-5ms on native PG).
      // synchronous_commit honors opts.synchronousCommit — callers serving
      // durability='committed' workflows pass true so COMMIT blocks on fsync.
      const commitMode = opts?.synchronousCommit ? 'ON' : 'OFF'
      await client.query(`BEGIN; SET LOCAL synchronous_commit = ${commitMode};`)
      const tAfterBegin = performance.now()

      const { from: copyFrom } = await import('pg-copy-streams')
      const runStream = client.query(copyFrom(
        `COPY ${this.q('workflow_runs')} (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "startedAt", "completedAt", "createdAt", "updatedAt") FROM STDIN`,
      ))
      runStream.write(runLines.join('\n') + '\n')
      runStream.end()
      await new Promise<void>((resolve, reject) => { runStream.on('finish', () => resolve()); runStream.on('error', reject) })
      const tAfterRuns = performance.now()

      const stepStream = client.query(copyFrom(
        `COPY ${this.q('workflow_steps')} (id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, output, error, attempt, "maxRetries", "startedAt", "completedAt", "scheduledAt", "lastHeartbeatAt", "lastHeartbeatData", "heartbeatTimeoutMs", "humanPrompt", "humanResponse", "humanRespondedBy", "humanRespondedAt", "iterationCount", "maxIterations", "tokensUsed", "costUsd", "modelUsed", "createdAt", "updatedAt") FROM STDIN`,
      ))
      stepStream.write(stepLines.join('\n') + '\n')
      stepStream.end()
      await new Promise<void>((resolve, reject) => { stepStream.on('finish', () => resolve()); stepStream.on('error', reject) })
      const tAfterSteps = performance.now()

      await client.query('COMMIT')
      const tAfterCommit = performance.now()

      if (process.env.INGEST_TIMING && triggers.length >= 50) {
        console.log(
          `[COPY] ${triggers.length}r begin=${(tAfterBegin - tBegin).toFixed(0)}ms ` +
          `runs=${(tAfterRuns - tAfterBegin).toFixed(0)}ms ` +
          `steps=${(tAfterSteps - tAfterRuns).toFixed(0)}ms ` +
          `commit=${(tAfterCommit - tAfterSteps).toFixed(0)}ms`,
        )
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // PG rows are committed. Emit run.started events before dispatching.
    if (this.config.onEngineEvent) {
      for (const { runId, definition, trigger, traceId } of results) {
        this.traceIdCache.set(runId, traceId)
        this.emitEvent({
          type: 'run.started',
          tenantId: trigger.tenantId, runId, traceId,
          workflowName: trigger.workflowName,
          workflowVersion: definition.version,
        })
      }
    }

    // Dispatch root steps in bulk (one addBulk per target queue)
    const dispatchItems: Array<{ runId: string; tenantId: string; step: WorkflowStep; definition: WorkflowDefinition }> = []
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        dispatchItems.push({ runId, tenantId: trigger.tenantId, step: stepRow as any, definition })
      }
    }
    await this.dispatchStepsBulk(dispatchItems)

    // finalRunIds is index-aligned with the input triggers — slots filled by
    // the dedup short-circuit hold the original runId; everything else holds
    // the freshly-COPY'd runId. results-derived dispatch only covered the
    // freshly-COPY'd subset, which is correct.
    return finalRunIds.map(id => ({ runId: id }))
  }

  // ── Step Running ───────────────────────────────────────────────

  async markStepRunning(runId: string, stepName: string, tenantId: string): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    if (!canStepTransition(step.status as StepStatus, 'RUNNING')) return

    // Hot-path batched UPDATE when the buffer is wired (pgPool present and
    // batching not disabled). The returned promise resolves only after the
    // batched UPDATE commits — preserving BullMQ ack semantics.
    if (this.stepStatusBuffer) {
      await this.stepStatusBuffer.enqueue({
        stepId: step.id,
        status: 'RUNNING',
        startedAt: new Date(),
      })
    } else {
      await this.updateStepStatus(step.id, step.status, 'RUNNING')
    }
    await this.logStepEvent(step.id, tenantId, 'started')

    // Event fires AFTER PG commit (await above). Subscribers can immediately
    // SELECT this step and see status=RUNNING.
    if (this.config.onEngineEvent) {
      const traceId = await this.resolveTraceId(runId, tenantId)
      this.emitEvent({
        type: 'step.running',
        tenantId, runId, traceId,
        stepName, attempt: step.attempt,
      })
    }
  }

  /**
   * In-memory cache of runId → traceId, populated on first lookup.
   * Avoids re-SELECTing the run for every event when onEngineEvent is wired.
   * Evicted on run completion (run.completed event firing).
   */
  private traceIdCache = new Map<string, string>()

  private async resolveTraceId(runId: string, tenantId: string): Promise<string> {
    let traceId = this.traceIdCache.get(runId)
    if (traceId) return traceId
    const row = await this.db.selectFrom('workflow_runs')
      .select('traceId')
      .where('id', '=', runId)
      .where('tenantId', '=', tenantId)
      .executeTakeFirst()
    traceId = row?.traceId ?? ''
    this.traceIdCache.set(runId, traceId)
    // Soft cap — protect against unbounded growth in long-lived processes
    if (this.traceIdCache.size > 5000) {
      const firstKey = this.traceIdCache.keys().next().value
      if (firstKey) this.traceIdCache.delete(firstKey)
    }
    return traceId
  }

  // ── Step Completion ────────────────────────────────────────────

  async onStepCompleted(
    runId: string, stepName: string, tenantId: string, result: StepResult,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    if (result.waitForHuman) {
      // HITL transition — single buffered UPDATE sets status + output + humanPrompt
      if (this.stepStatusBuffer && canStepTransition(step.status as StepStatus, 'WAITING_HUMAN')) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'WAITING_HUMAN',
          output: toJson(result.output),
          humanPrompt: toJson(result.waitForHuman),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'WAITING_HUMAN')
        await this.db.updateTable('workflow_steps').set({
          output: toJson(result.output),
          humanPrompt: toJson(result.waitForHuman),
          updatedAt: new Date(),
        }).where('id', '=', step.id).execute()
      }
      await this.logStepEvent(step.id, tenantId, 'human_requested', {
        prompt: result.waitForHuman.prompt,
      })
      // PG row now has status=WAITING_HUMAN + output + humanPrompt
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.human_requested',
          tenantId, runId, traceId, stepName,
          prompt: result.waitForHuman.prompt,
          schema: result.waitForHuman.schema,
        })
      }
    } else {
      // HOT PATH: single buffered UPDATE collapses status + output + completedAt
      // into one row of one batched statement.
      if (this.stepStatusBuffer && canStepTransition(step.status as StepStatus, 'COMPLETED')) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'COMPLETED',
          output: toJson(result.output),
          completedAt: new Date(),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'COMPLETED')
        await this.db.updateTable('workflow_steps').set({
          output: toJson(result.output),
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where('id', '=', step.id).execute()
      }
      await this.logStepEvent(step.id, tenantId, 'completed', {
        outputKeys: Object.keys(result.output),
      })
      // PG row now has status=COMPLETED + output + completedAt
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.completed',
          tenantId, runId, traceId, stepName,
          output: result.output,
        })
      }
    }

    // ── Budget enforcement: increment step counter ──────
    if (!result.waitForHuman) {
      const budgetExceeded = await this.incrementBudgetUsage(runId, 'steps')
      if (budgetExceeded) {
        this.config.logger?.warn(`Budget exceeded for run ${runId}: ${budgetExceeded}`)
        // Mark run as failed due to budget
        await this.db.updateTable('workflow_runs')
          .set({ status: 'FAILED', error: budgetExceeded, completedAt: new Date(), updatedAt: new Date() })
          .where('id', '=', runId)
          .execute()
        return
      }

      // Track token/cost from step output _usage field
      const usage = result.output?._usage as Record<string, unknown> | undefined
      if (usage) {
        if (typeof usage.tokens === 'number') {
          const tokenExceeded = await this.incrementBudgetUsage(runId, 'tokens', usage.tokens)
          if (tokenExceeded) {
            this.config.logger?.warn(`Budget exceeded for run ${runId}: ${tokenExceeded}`)
            await this.db.updateTable('workflow_runs')
              .set({ status: 'FAILED', error: tokenExceeded, completedAt: new Date(), updatedAt: new Date() })
              .where('id', '=', runId)
              .execute()
            return
          }
        }
        if (typeof usage.costUsd === 'number') {
          await this.incrementBudgetUsage(runId, 'costUsd', usage.costUsd)
        }
      }
    }

    // ── nextStep: runtime redirect (loop without DAG cycle) ──────
    if (result.nextStep) {
      const targetStepDef = definition.steps.find(s => s.name === result.nextStep)
      if (!targetStepDef) {
        await this.db.updateTable('workflow_steps').set({
          status: 'FAILED',
          error: `nextStep target "${result.nextStep}" does not exist in workflow "${definition.name}"`,
          updatedAt: new Date(),
        }).where('id', '=', step.id).execute()
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      const targetStep = await this.getStep(runId, result.nextStep, tenantId)
      const currentIteration = (targetStep as any).iterationCount ?? 0
      const maxIter = (targetStep as any).maxIterations ?? 100

      if (currentIteration >= maxIter) {
        await this.db.updateTable('workflow_steps').set({
          status: 'FAILED',
          error: `Step "${result.nextStep}" exceeded max iterations (${maxIter})`,
          updatedAt: new Date(),
        }).where('id', '=', step.id).execute()
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      // Reset target step to PENDING (bypass normal transition — runtime redirect)
      await this.db.updateTable('workflow_steps').set({
        status: 'PENDING',
        output: null,
        error: null,
        completedAt: null,
        startedAt: null,
        iterationCount: currentIteration + 1,
        updatedAt: new Date(),
      }).where('id', '=', targetStep.id).execute()

      await this.dispatchReadySteps(runId, tenantId, definition)
      return
    }

    await this.advanceWorkflow(runId, tenantId, definition)
  }

  // ── Step Failure ───────────────────────────────────────────────

  async onStepFailed(
    runId: string, stepName: string, tenantId: string, error: Error,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    const isNonRetryable = error instanceof NonRetryableError
    const canRetry = !isNonRetryable && step.attempt < step.maxRetries

    if (canRetry) {
      // Retry path keeps multi-column UPDATE on the sync path: `attempt` and
      // `startedAt=null` aren't carried by StepStatusBuffer's column set.
      // (Retry rate is low under normal load — buffering this isn't load-bearing.)
      await this.updateStepStatus(step.id, step.status, 'QUEUED')
      await this.db.updateTable('workflow_steps').set({
        attempt: step.attempt + 1,
        error: error.message,
        startedAt: null,
        updatedAt: new Date(),
      }).where('id', '=', step.id).execute()
      await this.logStepEvent(step.id, tenantId, 'retried', {
        attempt: step.attempt + 1,
        error: error.message,
      })
      await this.dispatchStep(runId, tenantId, step, definition)
    } else {
      // FAILED terminal — single buffered UPDATE for status + error + completedAt
      if (this.stepStatusBuffer && canStepTransition(step.status as StepStatus, 'FAILED')) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'FAILED')
        await this.db.updateTable('workflow_steps').set({
          error: error.message,
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where('id', '=', step.id).execute()
      }
      await this.logStepEvent(step.id, tenantId, 'failed', {
        attempt: step.attempt, error: error.message, nonRetryable: isNonRetryable,
      })
      // PG row now has status=FAILED. Emit terminal step event.
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.failed',
          tenantId, runId, traceId, stepName,
          error: error.message,
          attempt: step.attempt,
          terminal: true,
        })
      }
    }

    await this.advanceWorkflow(runId, tenantId, definition)
  }

  // ── Human Input ────────────────────────────────────────────────

  async submitHumanInput(input: HumanInput): Promise<void> {
    const step = await this.getStep(input.workflowRunId, input.stepName, input.tenantId)

    if (step.status !== 'WAITING_HUMAN') {
      throw new HumanInputError(
        `Step "${input.stepName}" is not waiting for human input (status: ${step.status})`,
        { stepName: input.stepName, status: step.status },
      )
    }

    const definition = await this.getDefinitionForRun(input.workflowRunId)

    await this.db.updateTable('workflow_steps').set({
      humanResponse: toJson(input.data),
      humanRespondedBy: input.respondedBy ?? null,
      humanRespondedAt: new Date(),
      updatedAt: new Date(),
    }).where('id', '=', step.id).execute()

    await this.logStepEvent(step.id, input.tenantId, 'human_responded', {
      respondedBy: input.respondedBy,
    })

    await this.updateStepStatus(step.id, step.status, 'COMPLETED')
    await this.db.updateTable('workflow_steps').set({
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where('id', '=', step.id).execute()

    await this.advanceWorkflow(input.workflowRunId, input.tenantId, definition)
  }

  // ── Cancel ─────────────────────────────────────────────────────

  async cancel(runId: string, tenantId: string): Promise<void> {
    const run = await this.getRun(runId, tenantId)
    if (run.status === 'COMPLETED' || run.status === 'CANCELLED') return

    await this.updateRunStatus(runId, 'CANCELLED')

    const steps = await this.db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('tenantId', '=', tenantId)
      .execute()

    for (const step of steps) {
      if (step.status === 'PENDING' || step.status === 'QUEUED' || step.status === 'WAITING_HUMAN') {
        await this.db.updateTable('workflow_steps')
          .set({ status: 'SKIPPED', updatedAt: new Date() })
          .where('id', '=', step.id)
          .execute()
        await this.logStepEvent(step.id, tenantId, 'cancelled')
      }
    }
  }

  // ── Query ──────────────────────────────────────────────────────

  async listWorkflows(
    tenantId: string,
    filters?: { status?: string[]; workflowName?: string; limit?: number; offset?: number },
  ): Promise<Array<WorkflowRun & { stepCount: number; completedStepCount: number }>> {
    let query = this.db
      .selectFrom('workflow_runs')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .orderBy('createdAt', 'desc')

    if (filters?.status?.length) {
      query = query.where('status', 'in', filters.status)
    }
    if (filters?.workflowName) {
      query = query.where('workflowName', '=', filters.workflowName)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    if (filters?.offset) {
      query = query.offset(filters.offset)
    }

    const runs = await query.execute()

    // Batch-fetch step counts
    const results = await Promise.all(
      runs.map(async run => {
        const steps = await this.db
          .selectFrom('workflow_steps')
          .select(['status'])
          .where('workflowRunId', '=', run.id)
          .execute()
        return {
          ...run,
          triggerInput: run.triggerInput ? fromJson(run.triggerInput) as any : null,
          output: run.output ? fromJson(run.output) as any : null,
          stepCount: steps.length,
          completedStepCount: steps.filter(s => s.status === 'COMPLETED' || s.status === 'SKIPPED').length,
        }
      }),
    )

    return results
  }

  async getStatus(runId: string, tenantId: string): Promise<WorkflowRun & { steps: WorkflowStep[] }> {
    const run = await this.getRun(runId, tenantId)
    const steps = await this.db
      .selectFrom('workflow_steps')
      .selectAll()
      .where('workflowRunId', '=', runId)
      .where('tenantId', '=', tenantId)
      .execute()
    // Hydrate JSON fields for external consumers
    return {
      ...run,
      triggerInput: run.triggerInput ? fromJson(run.triggerInput) as any : null,
      output: run.output ? fromJson(run.output) as any : null,
      steps: steps.map(s => ({
        ...s,
        input: s.input ? fromJson(s.input) as any : null,
        output: s.output ? fromJson(s.output) as any : null,
        executorConfig: s.executorConfig ? fromJson(s.executorConfig) as any : null,
        lastHeartbeatData: s.lastHeartbeatData ? fromJson(s.lastHeartbeatData) as any : null,
        dependsOn: s.dependsOn ? fromJson(s.dependsOn) as any : [],
        humanPrompt: s.humanPrompt ? fromJson(s.humanPrompt) as any : null,
        humanResponse: s.humanResponse ? fromJson(s.humanResponse) as any : null,
      })),
    }
  }

  getExecutor(type: string): StepExecutor | undefined {
    return this.config.executors.get(type)
  }

  // ── Trace ──────────────────────────────────────────────────────

  /**
   * Get full trace lineage: all runs, events, and external actions sharing a traceId.
   */
  async getTrace(traceId: string): Promise<{
    runs: WorkflowRun[]
    events: import('../entities/Database.js').WorkflowEvent[]
    actions: import('../entities/Database.js').ExternalAction[]
  }> {
    const [runs, events, actions] = await Promise.all([
      this.db.selectFrom('workflow_runs').selectAll().where('traceId', '=', traceId).execute(),
      this.db.selectFrom('workflow_events').selectAll().where('traceId', '=', traceId).execute(),
      this.db.selectFrom('external_actions').selectAll().where('traceId', '=', traceId).execute(),
    ])
    return { runs, events, actions }
  }

  // ── Heartbeat ──────────────────────────────────────────────────

  async heartbeat(runId: string, stepName: string, tenantId: string, data?: Record<string, unknown>): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    await this.db.updateTable('workflow_steps').set({
      lastHeartbeatAt: new Date(),
      lastHeartbeatData: toJson(data ?? null),
      updatedAt: new Date(),
    }).where('id', '=', step.id).execute()
    await this.logStepEvent(step.id, tenantId, 'heartbeat', data)
  }

  // ── Signals ────────────────────────────────────────────────────

  async signal(runId: string, tenantId: string, signalName: string, data: Record<string, unknown>): Promise<void> {
    const run = await this.getRun(runId, tenantId)
    const definition = this.config.workflows.get(run.workflowName)

    await this.db.insertInto('workflow_signals').values({
      id: Ids.nanoId(21),
      workflowRunId: runId,
      tenantId,
      signalName,
      data: toJson(data)!,
      createdAt: new Date(),
    }).execute()

    if (definition?.signals?.[signalName]) {
      const steps = await this.findSteps(runId, tenantId)
      const ctx = this.buildStepContext(run, steps)
      await definition.signals[signalName].handler(ctx, data as any)

      await this.db.updateTable('workflow_signals')
        .set({ processedAt: new Date() })
        .where('workflowRunId', '=', runId)
        .where('signalName', '=', signalName)
        .where('processedAt', 'is', null)
        .execute()
    }

    if (run.status === 'WAITING_HUMAN' && definition) {
      await this.advanceWorkflow(runId, tenantId, definition)
    }
  }

  // ── Queries ────────────────────────────────────────────────────

  async query(runId: string, tenantId: string, queryName: string): Promise<Record<string, unknown>> {
    const run = await this.getRun(runId, tenantId)
    const definition = this.config.workflows.get(run.workflowName)

    if (!definition?.queries?.[queryName]) {
      throw new WorkflowError(`No query handler registered for "${queryName}"`, 'QUERY_NOT_FOUND', { queryName })
    }

    const steps = await this.findSteps(runId, tenantId)
    const ctx = this.buildStepContext(run, steps)
    const result = await definition.queries[queryName].handler(ctx)
    return result as Record<string, unknown>
  }

  // ── Internal Helpers ───────────────────────────────────────────

  private async advanceWorkflow(runId: string, tenantId: string, definition: WorkflowDefinition): Promise<void> {
    const steps = await this.findSteps(runId, tenantId)
    const newStatus = deriveWorkflowStatus(steps.map(s => ({ status: s.status as StepStatus })))
    const run = await this.getRun(runId, tenantId)

    if (newStatus !== run.status && canWorkflowTransition(run.status as WorkflowStatus, newStatus)) {
      await this.updateRunStatus(runId, newStatus)

      if (newStatus === 'COMPLETED') {
        const mergedOutput = this.mergeStepOutputs(steps)
        await this.db.updateTable('workflow_runs').set({
          completedAt: new Date(),
          output: toJson(mergedOutput),
          updatedAt: new Date(),
        }).where('id', '=', runId).execute()
        if (definition.onComplete) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onComplete(ctx)
        }
        // PG row now has status=COMPLETED. Emit terminal event.
        this.emitEvent({
          type: 'run.completed',
          tenantId, runId,
          traceId: run.traceId ?? '',
          status: 'COMPLETED',
          output: mergedOutput,
        })
        this.traceIdCache.delete(runId) // free the cache entry
      } else if (newStatus === 'FAILED') {
        const failedStep = steps.find(s => s.status === 'FAILED')
        const errorMsg = failedStep?.error ?? 'Unknown error'
        await this.db.updateTable('workflow_runs').set({
          completedAt: new Date(),
          error: errorMsg,
          updatedAt: new Date(),
        }).where('id', '=', runId).execute()
        if (definition.onFail) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onFail(ctx, new Error(errorMsg))
        }
        // PG row now has status=FAILED. Emit terminal event.
        this.emitEvent({
          type: 'run.completed',  // shared event type for terminal states
          tenantId, runId,
          traceId: run.traceId ?? '',
          status: 'FAILED',
          error: errorMsg,
        })
        this.traceIdCache.delete(runId)
      }
    }

    if (newStatus === 'RUNNING') {
      await this.dispatchReadySteps(runId, tenantId, definition)
    }
  }

  private async dispatchReadySteps(runId: string, tenantId: string, definition: WorkflowDefinition): Promise<void> {
    const steps = await this.findSteps(runId, tenantId)
    const statuses: Record<string, StepStatus> = {}
    for (const step of steps) statuses[step.stepName] = step.status as StepStatus

    const readyNames = getReadySteps(definition.steps, statuses)

    for (const name of readyNames) {
      // Per-workflow concurrency fairness: check before each dispatch
      if (this.config.maxConcurrentStepsPerWorkflow) {
        const activeCount = await this.db
          .selectFrom('workflow_steps')
          .select(sql`count(*)`.as('count'))
          .where('workflowRunId', '=', runId)
          .where('status', 'in', ['QUEUED', 'RUNNING'])
          .executeTakeFirst()

        if (Number(activeCount?.count ?? 0) >= this.config.maxConcurrentStepsPerWorkflow) {
          return // Don't dispatch more steps — at concurrency limit
        }
      }
      const stepDef = definition.steps.find(s => s.name === name)!
      const stepRow = steps.find(s => s.stepName === name)!

      if (stepDef.condition) {
        const run = await this.getRun(runId, tenantId)
        const ctx = this.buildStepContext(run, steps)
        const shouldRun = await stepDef.condition(ctx)
        if (!shouldRun) {
          await this.db.updateTable('workflow_steps')
            .set({ status: 'SKIPPED', updatedAt: new Date() })
            .where('id', '=', stepRow.id).execute()
          await this.logStepEvent(stepRow.id, tenantId, 'skipped')
          await this.advanceWorkflow(runId, tenantId, definition)
          return
        }
      }

      let input: JsonObject = {}
      if (stepDef.mapInput) {
        const completedOutputs: Record<string, JsonObject> = {}
        for (const s of steps) {
          if (s.status === 'COMPLETED' && s.output) {
            completedOutputs[s.stepName] = fromJson(s.output) as JsonObject
          }
        }
        const run = await this.getRun(runId, tenantId)
        completedOutputs.__trigger = (fromJson(run.triggerInput) ?? {}) as JsonObject
        input = stepDef.mapInput(completedOutputs)
      } else {
        const run = await this.getRun(runId, tenantId)
        input = (fromJson(run.triggerInput) ?? {}) as JsonObject
      }

      await this.db.updateTable('workflow_steps').set({
        input: toJson(input),
        scheduledAt: new Date(),
        status: 'QUEUED',
        updatedAt: new Date(),
      }).where('id', '=', stepRow.id).execute()
      await this.logStepEvent(stepRow.id, tenantId, 'queued')

      // Re-fetch after update for dispatch
      const freshStep = await this.db.selectFrom('workflow_steps').selectAll().where('id', '=', stepRow.id).executeTakeFirst()
      if (freshStep) await this.dispatchStep(runId, tenantId, freshStep, definition)
    }
  }

  /**
   * Bulk-dispatch step jobs in one round-trip per target queue.
   * Uses BullMQ's addBulk (one Redis LUA call per queue) when available;
   * otherwise falls back to the per-step loop for non-BullMQ connectors.
   */
  private async dispatchStepsBulk(
    items: Array<{ runId: string; tenantId: string; step: WorkflowStep; definition: WorkflowDefinition }>,
  ): Promise<void> {
    if (items.length === 0) return

    const QUEUE_MAP: Record<string, string> = {
      light: 'workflow_step_light',
      heavy: 'workflow_step_heavy',
      ai: 'workflow_step_ai',
      sandbox: 'workflow_step_sandbox',
    }

    // Build the bulk job list (TaskConnector.bulkQueue shape — backend-agnostic).
    // Grouping by queue happens inside the adapter (BullMQ groups by taskName
    // for one addBulk per queue; other backends can fan-out however they want).
    const jobs: Array<{
      uniqueTaskName: string
      taskName: string
      taskBody: object
      opts?: Record<string, unknown>
    }> = []
    for (const { runId, tenantId, step, definition } of items) {
      const stepDef = definition.steps.find(s => s.name === step.stepName)!
      const payload: StepPayload = {
        workflowRunId: runId,
        stepName: step.stepName,
        tenantId,
        input: (fromJson(step.input) ?? {}) as JsonObject,
        attempt: step.attempt,
        executorType: step.executorType,
        executorConfig: (fromJson(step.executorConfig) ?? {}) as JsonObject,
        lastHeartbeatData: fromJson(step.lastHeartbeatData) as JsonObject | undefined,
        heartbeatTimeoutMs: step.heartbeatTimeoutMs ?? undefined,
        scheduleToStartTimeoutMs: stepDef.scheduleToStartTimeoutMs ?? undefined,
      }
      const iterCount = (step as any).iterationCount ?? 0
      const jobId = `wf-${runId}-${step.stepName}-${step.attempt}-i${iterCount}`
      const queueName = QUEUE_MAP[stepDef.stepWeight ?? 'light'] ?? 'workflow_step_light'

      jobs.push({
        uniqueTaskName: jobId,
        taskName: queueName,
        taskBody: payload as object,
        opts: { removeOnComplete: true, removeOnFail: 100 },
      })
    }

    // Backend-agnostic: TaskConnector.bulkQueue (one Lua/HTTP roundtrip per
    // target queue when the adapter implements it natively).
    if (typeof this.config.connector.bulkQueue === 'function') {
      await this.config.connector.bulkQueue(jobs)
      return
    }

    // Fallback for connectors without bulkQueue — per-step queue() in parallel
    await Promise.all(items.map(it => this.dispatchStep(it.runId, it.tenantId, it.step, it.definition)))
  }

  private async dispatchStep(runId: string, tenantId: string, step: WorkflowStep, definition: WorkflowDefinition): Promise<void> {
    const stepDef = definition.steps.find(s => s.name === step.stepName)!

    const payload: StepPayload = {
      workflowRunId: runId,
      stepName: step.stepName,
      tenantId,
      input: (fromJson(step.input) ?? {}) as JsonObject,
      attempt: step.attempt,
      executorType: step.executorType,
      executorConfig: (fromJson(step.executorConfig) ?? {}) as JsonObject,
      lastHeartbeatData: fromJson(step.lastHeartbeatData) as JsonObject | undefined,
      heartbeatTimeoutMs: step.heartbeatTimeoutMs ?? undefined,
      scheduleToStartTimeoutMs: stepDef.scheduleToStartTimeoutMs ?? undefined,
    }

    const iterCount = (step as any).iterationCount ?? 0
    const jobId = `wf-${runId}-${step.stepName}-${step.attempt}-i${iterCount}`
    const QUEUE_MAP: Record<string, string> = {
      light: 'workflow_step_light',
      heavy: 'workflow_step_heavy',
      ai: 'workflow_step_ai',
      sandbox: 'workflow_step_sandbox',
    }
    const queueName = QUEUE_MAP[stepDef.stepWeight ?? 'light'] ?? 'workflow_step_light'

    await this.config.connector.queue({
      uniqueTaskName: jobId,
      taskName: queueName,
      postUrl: '/workflow/step',
      taskBody: payload,
      handle: async () => {},
    })
  }

  private async updateRunStatus(runId: string, status: WorkflowStatus | string): Promise<void> {
    const set: Record<string, unknown> = { status, updatedAt: new Date() }
    if (status === 'RUNNING') set.startedAt = new Date()
    await this.db.updateTable('workflow_runs').set(set).where('id', '=', runId).execute()
  }

  private async updateStepStatus(stepId: string, currentStatus: string, newStatus: StepStatus): Promise<void> {
    if (canStepTransition(currentStatus as StepStatus, newStatus)) {
      const set: Record<string, unknown> = { status: newStatus, updatedAt: new Date() }
      if (newStatus === 'RUNNING') set.startedAt = new Date()
      await this.db.updateTable('workflow_steps').set(set).where('id', '=', stepId).execute()
    }
  }

  private async logStepEvent(stepId: string, tenantId: string, event: string, data?: Record<string, unknown>): Promise<void> {
    const entry = { id: Ids.nanoId(21), stepId, tenantId, event, data }

    // Synchronous path when buffering is disabled (debugging, low-volume use)
    if (this.config.disableLogBuffering || !this.logBuffer) {
      await this.db.insertInto('workflow_step_logs').values({
        id: entry.id,
        stepId: entry.stepId,
        tenantId: entry.tenantId,
        event: entry.event,
        data: toJson(entry.data ?? null),
        createdAt: new Date(),
      }).execute()
      return
    }

    this.logBuffer.enqueue(entry)
  }

  /**
   * Batched log writer used by the WriteBuffer flushFn.
   * COPY FROM if pgPool is available; falls back to a single batched INSERT
   * otherwise. On failure WriteBuffer re-prepends the items for retry.
   */
  private async writeLogBatch(batch: Array<{
    id: string
    stepId: string
    tenantId: string
    event: string
    data?: Record<string, unknown>
  }>): Promise<void> {
    if (batch.length === 0) return
    const now = new Date().toISOString()

    if (this.config.pgPool) {
      const lines = batch.map(e =>
        [e.id, e.stepId, e.tenantId, e.event, esc(toJson(e.data ?? null)), now].join('\t'),
      ).join('\n') + '\n'

      const client = await this.config.pgPool.connect()
      try {
        const { from: copyFrom } = await import('pg-copy-streams')
        const stream = client.query(copyFrom(
          `COPY ${this.q('workflow_step_logs')} (id, "stepId", "tenantId", event, data, "createdAt") FROM STDIN`,
        ))
        stream.write(lines)
        stream.end()
        await new Promise<void>((resolve, reject) => { stream.on('finish', () => resolve()); stream.on('error', reject) })
      } finally {
        client.release()
      }
      return
    }

    await this.db.insertInto('workflow_step_logs').values(
      batch.map(e => ({
        id: e.id,
        stepId: e.stepId,
        tenantId: e.tenantId,
        event: e.event,
        data: toJson(e.data ?? null),
        createdAt: new Date(),
      })),
    ).execute()
  }

  /**
   * DESIGN: Step-status batching is the next big win (~1.5–2× completion
   * throughput per Hatchet's pattern), but it requires changes to BullMQ ack
   * semantics: the per-job promise must wait for the buffered UPDATE to
   * commit before resolving, otherwise crashes between ack and flush would
   * silently lose COMPLETED state.
   *
   * Sketch:
   *   - StepStatusBuffer: WriteBuffer<{stepId, status, output?, error?, completedAt}>
   *   - flushFn issues a single `UPDATE workflow_steps SET status=v.status,
   *       output=v.output, completed_at=v.ts FROM (VALUES ...) AS v WHERE id = v.id`
   *   - WorkflowStepTask.handle awaits flushFn completion before returning
   *     (so BullMQ only acks after PG commit)
   *   - Same atomic-batch + re-prepend semantics as IngestWorker
   *
   * Tracked as a follow-up; not implemented in this commit because the
   * change to ack semantics needs careful integration testing across all
   * step paths (markRunning, onCompleted, onFailed, retry, HITL).
   */

  private async getRun(runId: string, tenantId: string): Promise<WorkflowRun> {
    const run = await this.db.selectFrom('workflow_runs').selectAll()
      .where('id', '=', runId).where('tenantId', '=', tenantId).executeTakeFirst()
    if (!run) throw new WorkflowRunNotFoundError(runId)
    return run
  }

  private async getStep(runId: string, stepName: string, tenantId: string): Promise<WorkflowStep> {
    const step = await this.db.selectFrom('workflow_steps').selectAll()
      .where('workflowRunId', '=', runId).where('stepName', '=', stepName).where('tenantId', '=', tenantId)
      .executeTakeFirst()
    if (!step) throw new WorkflowRunNotFoundError(`Step "${stepName}" in run "${runId}" not found`)
    return step
  }

  private async findSteps(runId: string, tenantId: string): Promise<WorkflowStep[]> {
    return this.db.selectFrom('workflow_steps').selectAll()
      .where('workflowRunId', '=', runId).where('tenantId', '=', tenantId).execute()
  }

  private async getDefinitionForRun(runId: string): Promise<WorkflowDefinition> {
    const run = await this.db.selectFrom('workflow_runs').select('workflowName')
      .where('id', '=', runId).executeTakeFirst()
    if (!run) throw new WorkflowRunNotFoundError(runId)
    const def = this.config.workflows.get(run.workflowName)
    if (!def) throw new WorkflowNotFoundError(run.workflowName)
    return def
  }

  // ── Budget Guardrails ─────────────────────────────────────────

  /**
   * Increment budget usage and check limits. Returns the reason if budget is exceeded, null otherwise.
   */
  async incrementBudgetUsage(
    runId: string,
    field: keyof BudgetUsed,
    amount: number = 1,
  ): Promise<string | null> {
    const run = await this.db.selectFrom('workflow_runs')
      .select(['budget', 'budgetUsed'])
      .where('id', '=', runId)
      .executeTakeFirst()

    if (!run) return null

    const budget = fromJson<WorkflowBudget>(run.budget)
    const used = fromJson<BudgetUsed>(run.budgetUsed) ?? { tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }

    used[field] = (used[field] ?? 0) + amount

    // Persist updated usage
    await this.db.updateTable('workflow_runs')
      .set({ budgetUsed: toJson(used), updatedAt: new Date() })
      .where('id', '=', runId)
      .execute()

    if (!budget) return null

    // Check limits (>= because reaching the limit means it's exceeded)
    if (budget.maxTokens && used.tokens >= budget.maxTokens) {
      return `Token budget exceeded: ${used.tokens}/${budget.maxTokens}`
    }
    if (budget.maxCostUsd && used.costUsd >= budget.maxCostUsd) {
      return `Cost budget exceeded: $${used.costUsd}/$${budget.maxCostUsd}`
    }
    if (budget.maxSteps && used.steps >= budget.maxSteps) {
      return `Step budget exceeded: ${used.steps}/${budget.maxSteps}`
    }
    if (budget.maxTaskExecutions && used.taskExecutions >= budget.maxTaskExecutions) {
      return `Task execution budget exceeded: ${used.taskExecutions}/${budget.maxTaskExecutions}`
    }

    return null
  }

  /**
   * Get the current budget usage for a workflow run.
   */
  async getBudgetUsage(runId: string): Promise<{ budget: WorkflowBudget | null; used: BudgetUsed }> {
    const run = await this.db.selectFrom('workflow_runs')
      .select(['budget', 'budgetUsed'])
      .where('id', '=', runId)
      .executeTakeFirst()

    return {
      budget: run ? fromJson<WorkflowBudget>(run.budget) : null,
      used: run ? (fromJson<BudgetUsed>(run.budgetUsed) ?? { tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }) : { tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 },
    }
  }

  private buildStepContext(run: WorkflowRun, steps: WorkflowStep[]): StepContext {
    const completedOutputs: Record<string, JsonObject> = {}
    for (const s of steps) {
      if (s.status === 'COMPLETED' && s.output) {
        completedOutputs[s.stepName] = fromJson(s.output) as JsonObject
      }
    }
    return {
      workflowRunId: run.id,
      tenantId: run.tenantId,
      completedOutputs,
      triggerInput: (fromJson(run.triggerInput) ?? {}) as JsonObject,
      // tasks are populated lazily via getTaskResults() when needed
    }
  }

  /**
   * Build a StepContext with task results from upstream steps populated.
   * Used by aggregation steps that need to access fan-out results.
   */
  async buildStepContextWithTasks(run: WorkflowRun, steps: WorkflowStep[]): Promise<StepContext> {
    const ctx = this.buildStepContext(run, steps)
    const tasks: Record<string, Array<{ id: string; payload: JsonObject | null; result: JsonObject | null; status: string }>> = {}

    // Populate task results for all completed steps that used task_runner
    for (const s of steps) {
      if (s.status === 'COMPLETED' && s.executorType === 'task_runner') {
        tasks[s.stepName] = await this.taskManager.getTaskResults(run.id, s.stepName)
      }
    }

    if (Object.keys(tasks).length > 0) {
      ctx.tasks = tasks
    }
    return ctx
  }

  private mergeStepOutputs(steps: WorkflowStep[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    for (const s of steps) {
      if (s.output) merged[s.stepName] = fromJson(s.output)
    }
    return merged
  }
}

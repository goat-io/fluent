// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import { nanoId } from '../db/ids.js'

/** Escape a value for COPY FROM tab-delimited format */
function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) {
    return '\\N'
  }
  // Fast path: skip the four regex replaces when nothing needs escaping
  if (!ESC_NEEDED.test(v)) {
    return v
  }
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
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
import type { DbClient } from '../db/DbClient.js'
import type { WorkflowRun, WorkflowStep } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import {
  HumanInputError,
  InputValidationError,
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
  topologicalSort,
} from '../state/WorkflowStateMachine.js'
import type { StepExecutor } from '../steps/StepExecutor.js'
import type {
  BackoffConfig,
  HumanInput,
  StepContext,
  StepPayload,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowTriggerInput,
} from '../workflow/WorkflowBuilder.types.js'
import type { EngineEvent } from './EngineEvent.types.js'
import { ExternalActionExecutor } from './ExternalActionExecutor.js'
import { StepStatusBuffer } from './StepStatusBuffer.js'
import { TaskManager } from './TaskManager.js'
import type {
  BudgetUsed,
  WorkflowBudget,
  WorkflowEngineConfig,
} from './WorkflowEngine.types.js'
import { WriteBuffer } from './WriteBuffer.js'

/**
 * Compute epoch-ms timestamp after which a retrying step should be re-claimed.
 * Returns null when no backoff is configured (immediate retry).
 */
export function computeRetryDelay(
  backoff: BackoffConfig | undefined,
  attempt: number,
): number | null {
  if (!backoff) {
    return null
  }

  const delayMs = backoff.delayMs ?? 1000
  const maxDelayMs = backoff.maxDelayMs ?? 60_000
  const multiplier = backoff.multiplier ?? 2

  let baseDelay: number
  if (backoff.type === 'fixed') {
    baseDelay = delayMs
  } else {
    // exponential: delay * multiplier^attempt, capped at maxDelayMs
    baseDelay = Math.min(delayMs * multiplier ** attempt, maxDelayMs)
  }

  // Add jitter: ±25% to avoid thundering herd
  const jitter = baseDelay * 0.25 * (2 * Math.random() - 1)
  const finalDelay = Math.max(0, Math.round(baseDelay + jitter))

  return Date.now() + finalDelay
}

/** Distributive Omit — preserves discriminated union after removing `emittedAt`. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never
type EmittableEvent = DistributiveOmit<EngineEvent, 'emittedAt'>

export class WorkflowEngine {
  readonly config: WorkflowEngineConfig
  readonly db: DbClient

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
    workflowRunId: string | null
    tenantId: string
    event: string
    data?: Record<string, unknown>
  }> | null = null

  // Note: Start buffering is handled via startBatch() for batch API.
  // Single starts use raw SQL single-round-trip optimization.

  // Cached stringified + COPY-escaped snapshots, keyed by "name@version".
  // Workflow definitions are immutable for a given version, so stringify once
  // per definition instead of per row (saves ~30–60% CPU on large batches).
  private snapshotCache: Map<
    string,
    {
      snapshot: string
      snapshotEsc: string
      // Per-step cached escapes for COPY lines (executorConfig, dependsOn)
      stepEscapes: Map<
        string,
        { executorConfigEsc: string; dependsOnEsc: string }
      >
    }
  > = new Map()

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
   * Optional Postgres schema prefix (e.g. 'agents'). When set, raw SQL
   * strings interpolate the prefix. Sub-services (TaskManager, ExternalActions,
   * etc.) receive the same db so their own queries get the prefix for free.
   */
  private readonly schema?: string

  /** `agents.workflow_runs` if schema set; otherwise just `workflow_runs`. */
  private q(table: string): string {
    return this.schema ? `${this.schema}.${table}` : table
  }

  /** Public alias of `q()` — used by WorkflowStepTask for transactional SQL. */
  qualifiedTable(table: string): string {
    return this.q(table)
  }

  /**
   * Fire an engine event AFTER its corresponding PG write has committed.
   * Synchronous from the engine's POV — never await this. Errors thrown by
   * the user's hook are caught and logged so a buggy subscriber cannot crash
   * a workflow.
   */
  private emitEvent(evt: EmittableEvent): void {
    if (!this.config.onEngineEvent) {
      return
    }
    try {
      this.config.onEngineEvent({
        ...evt,
        emittedAt: new Date(),
      } as EngineEvent)
    } catch (err) {
      this.config.logger?.error?.(
        '[Engine] onEngineEvent hook threw — swallowed',
        err,
      )
    }
  }

  constructor(config: WorkflowEngineConfig) {
    this.config = config
    this.schema = config.schema
    this.db = config.db

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
        flushFn: batch => this.writeLogBatch(batch),
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
    if (this.logBuffer) {
      await this.logBuffer.shutdown()
    }
    if (this.stepStatusBuffer) {
      await this.stepStatusBuffer.shutdown()
    }
  }

  // ── Start Workflow ─────────────────────────────────────────────

  async start(trigger: WorkflowTriggerInput): Promise<{ runId: string }> {
    const definition = this.config.workflows.get(trigger.workflowName)
    if (!definition) {
      throw new WorkflowNotFoundError(trigger.workflowName)
    }

    // DBOS-parity: input validation (Zod-compatible schema)
    if (definition.inputSchema) {
      try {
        definition.inputSchema.parse(trigger.input)
      } catch (err: any) {
        throw new InputValidationError(
          err.message ?? 'Input validation failed',
          { workflowName: trigger.workflowName },
        )
      }
    }

    const runId = nanoId(21)
    const now = new Date()

    // Generate traceId if not provided
    const traceId = trigger.traceId ?? nanoId(21)

    // DBOS-parity: delayed execution
    const isDelayed = (trigger.delaySeconds ?? 0) > 0

    const runRow = {
      id: runId,
      tenantId: trigger.tenantId,
      workflowName: trigger.workflowName,
      workflowVersion: definition.version,
      status: isDelayed ? 'DELAYED' : 'RUNNING',
      startedAt: isDelayed ? null : now,
      definitionSnapshot: toJson({
        name: definition.name,
        version: definition.version,
        defaultRetries: definition.defaultRetries,
        defaultTimeoutMs: definition.defaultTimeoutMs,
        failFast: definition.failFast,
        durability: definition.durability,
        triggers: definition.triggers,
        steps: definition.steps.map(s => ({
          name: s.name,
          dependsOn: s.dependsOn,
          executorType: s.executorType,
          executorConfig: s.executorConfig,
          retries: s.retries,
          backoff: s.backoff,
          timeoutMs: s.timeoutMs,
          heartbeatTimeoutMs: s.heartbeatTimeoutMs,
          scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
          requiresHumanApproval: s.requiresHumanApproval,
          stepWeight: s.stepWeight,
          maxIterations: s.maxIterations,
          requiresLabels: s.requiresLabels,
          transactional: s.transactional,
        })),
      }),
      triggerInput: toJson(trigger.input),
      idempotencyKey: trigger.idempotencyKey ?? null,
      traceId,
      parentRunId: trigger.parentRunId ?? null,
      originEventId: trigger.originEventId ?? null,
      budget: toJson(this.config.defaultBudget ?? null),
      budgetUsed: toJson({
        tokens: 0,
        costUsd: 0,
        steps: 0,
        taskExecutions: 0,
      }),
      deadlineEpochMs: definition.defaultTimeoutMs
        ? String(Date.now() + definition.defaultTimeoutMs)
        : null,
      timeoutMs: definition.defaultTimeoutMs
        ? String(definition.defaultTimeoutMs)
        : null,
      forkedFromRunId: null,
      applicationVersion: this.config.applicationVersion ?? null,
      delayUntilEpochMs: isDelayed
        ? String(Date.now() + trigger.delaySeconds! * 1000)
        : null,
      createdAt: now,
      updatedAt: now,
    }

    // Root steps get QUEUED directly (skip PENDING → QUEUED update)
    const rootNames = new Set(
      definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name),
    )

    const stepRows = definition.steps.map(stepDef => {
      const isRoot = rootNames.has(stepDef.name)
      let input: JsonObject = trigger.input as JsonObject
      if (isRoot && stepDef.mapInput) {
        input = stepDef.mapInput({})
      }

      return {
        id: nanoId(21),
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
        requiresLabels: stepDef.requiresLabels?.length
          ? toJson(stepDef.requiresLabels)
          : null,
        createdAt: now,
        updatedAt: now,
      }
    })

    // DBOS-parity: INSERT ON CONFLICT for idempotency (single round-trip, no race window)
    if (trigger.idempotencyKey) {
      const { rows } = await this.db.query<{ id: string }>(
        `INSERT INTO ${this.q('workflow_runs')} (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "deadlineEpochMs", "timeoutMs", "forkedFromRunId", "applicationVersion", "delayUntilEpochMs", "startedAt", "completedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT ("tenantId", "idempotencyKey") DO UPDATE SET "updatedAt" = $22
         RETURNING id`,
        [
          runRow.id,
          runRow.tenantId,
          runRow.workflowName,
          runRow.workflowVersion,
          runRow.status,
          runRow.definitionSnapshot,
          runRow.triggerInput,
          runRow.idempotencyKey,
          runRow.traceId,
          runRow.parentRunId,
          runRow.originEventId,
          runRow.budget,
          runRow.budgetUsed,
          runRow.deadlineEpochMs,
          runRow.timeoutMs,
          runRow.forkedFromRunId,
          runRow.applicationVersion,
          runRow.delayUntilEpochMs,
          runRow.startedAt,
          null,
          runRow.createdAt,
          runRow.updatedAt,
        ],
      )

      // If ON CONFLICT hit, returned id differs from our generated runId
      if (rows[0] && rows[0].id !== runId) {
        return { runId: rows[0].id }
      }
    } else {
      await this.db.query(
        `INSERT INTO ${this.q('workflow_runs')} (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "deadlineEpochMs", "timeoutMs", "forkedFromRunId", "applicationVersion", "delayUntilEpochMs", "startedAt", "completedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          runRow.id,
          runRow.tenantId,
          runRow.workflowName,
          runRow.workflowVersion,
          runRow.status,
          runRow.definitionSnapshot,
          runRow.triggerInput,
          runRow.idempotencyKey,
          runRow.traceId,
          runRow.parentRunId,
          runRow.originEventId,
          runRow.budget,
          runRow.budgetUsed,
          runRow.deadlineEpochMs,
          runRow.timeoutMs,
          runRow.forkedFromRunId,
          runRow.applicationVersion,
          runRow.delayUntilEpochMs,
          runRow.startedAt,
          null,
          runRow.createdAt,
          runRow.updatedAt,
        ],
      )
    }

    if (stepRows.length > 0) {
      // Build multi-row INSERT for steps
      const stepCols = `(id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, "scheduledAt", attempt, "maxRetries", "heartbeatTimeoutMs", "iterationCount", "maxIterations", "requiresLabels", "createdAt", "updatedAt")`
      const stepPlaceholders: string[] = []
      const stepParams: any[] = []
      let idx = 1
      for (const sr of stepRows) {
        stepPlaceholders.push(
          `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17})`,
        )
        stepParams.push(
          sr.id,
          sr.workflowRunId,
          sr.tenantId,
          sr.stepName,
          sr.status,
          sr.executorType,
          sr.executorConfig,
          sr.dependsOn,
          sr.input,
          sr.scheduledAt,
          sr.attempt,
          sr.maxRetries,
          sr.heartbeatTimeoutMs,
          sr.iterationCount,
          sr.maxIterations,
          sr.requiresLabels,
          sr.createdAt,
          sr.updatedAt,
        )
        idx += 18
      }
      await this.db.query(
        `INSERT INTO ${this.q('workflow_steps')} ${stepCols} VALUES ${stepPlaceholders.join(',')}`,
        stepParams,
      )
    }

    // PG row exists. Cache traceId and emit run.started before dispatching.
    if (this.config.onEngineEvent) {
      this.traceIdCache.set(runId, runRow.traceId)
      this.emitEvent({
        type: 'run.started',
        tenantId: trigger.tenantId,
        runId,
        traceId: runRow.traceId,
        workflowName: trigger.workflowName,
        workflowVersion: definition.version,
      })
    }

    // DBOS-parity: skip dispatch for delayed workflows — they start via transitionDelayedWorkflows()
    if (!isDelayed) {
      // Dispatch root steps to BullMQ (rows are in DB now)
      for (const stepDef of definition.steps) {
        if (!rootNames.has(stepDef.name)) {
          continue
        }
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        await this.dispatchStep(
          runId,
          trigger.tenantId,
          stepRow as any,
          definition,
        )
      }
    }

    return { runId }
  }

  /**
   * Batch start multiple workflows in a single DB transaction.
   * Hatchet pattern: batch inserts for high-throughput scenarios.
   * Use this instead of calling start() in a loop.
   */
  async startBatch(
    triggers: WorkflowTriggerInput[],
  ): Promise<Array<{ runId: string }>> {
    if (triggers.length === 0) {
      return []
    }

    const results: Array<{
      runId: string
      runRow: any
      stepRows: any[]
      definition: WorkflowDefinition
      trigger: WorkflowTriggerInput
    }> = []

    for (const trigger of triggers) {
      const definition = this.config.workflows.get(trigger.workflowName)
      if (!definition) {
        throw new WorkflowNotFoundError(trigger.workflowName)
      }

      const runId = trigger.runId ?? nanoId(21)
      const now = new Date()
      const rootNames = new Set(
        definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name),
      )

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
            backoff: s.backoff,
            timeoutMs: s.timeoutMs,
            heartbeatTimeoutMs: s.heartbeatTimeoutMs,
            scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
            requiresHumanApproval: s.requiresHumanApproval,
            stepWeight: s.stepWeight,
            maxIterations: s.maxIterations,
            requiresLabels: s.requiresLabels,
            transactional: s.transactional,
          })),
        }),
        triggerInput: toJson(trigger.input),
        idempotencyKey: trigger.idempotencyKey ?? null,
        traceId: trigger.traceId ?? nanoId(21),
        parentRunId: trigger.parentRunId ?? null,
        originEventId: trigger.originEventId ?? null,
        budget: toJson(this.config.defaultBudget ?? null),
        budgetUsed: toJson({
          tokens: 0,
          costUsd: 0,
          steps: 0,
          taskExecutions: 0,
        }),
        createdAt: now,
        updatedAt: now,
      }

      const stepRows = definition.steps.map(stepDef => {
        const isRoot = rootNames.has(stepDef.name)
        let input: JsonObject = trigger.input as JsonObject
        if (isRoot && stepDef.mapInput) {
          input = stepDef.mapInput({})
        }
        return {
          id: nanoId(21),
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
          requiresLabels: stepDef.requiresLabels?.length
            ? toJson(stepDef.requiresLabels)
            : null,
          createdAt: now,
          updatedAt: now,
        }
      })

      results.push({ runId, runRow, stepRows, definition, trigger })
    }

    // Use COPY FROM if pgPool is available (Hatchet fastest path), else batch INSERT
    if (this.config.pgPool) {
      return this.startBatchCopy(triggers)
    }

    // Batch INSERT fallback — build multi-row INSERTs
    {
      const runCols = `(id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "startedAt", "createdAt", "updatedAt")`
      const runPlaceholders: string[] = []
      const runParams: any[] = []
      let idx = 1
      for (const { runRow } of results) {
        runPlaceholders.push(
          `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15})`,
        )
        runParams.push(
          runRow.id,
          runRow.tenantId,
          runRow.workflowName,
          runRow.workflowVersion,
          runRow.status,
          runRow.definitionSnapshot,
          runRow.triggerInput,
          runRow.idempotencyKey,
          runRow.traceId,
          runRow.parentRunId,
          runRow.originEventId,
          runRow.budget,
          runRow.budgetUsed,
          runRow.startedAt,
          runRow.createdAt,
          runRow.updatedAt,
        )
        idx += 16
      }
      await this.db.query(
        `INSERT INTO ${this.q('workflow_runs')} ${runCols} VALUES ${runPlaceholders.join(',')}`,
        runParams,
      )
    }

    const allStepRows = results.flatMap(r => r.stepRows)
    if (allStepRows.length > 0) {
      const stepCols = `(id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, "scheduledAt", attempt, "maxRetries", "heartbeatTimeoutMs", "iterationCount", "maxIterations", "requiresLabels", "createdAt", "updatedAt")`
      const stepPlaceholders: string[] = []
      const stepParams: any[] = []
      let idx = 1
      for (const sr of allStepRows) {
        stepPlaceholders.push(
          `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17})`,
        )
        stepParams.push(
          sr.id,
          sr.workflowRunId,
          sr.tenantId,
          sr.stepName,
          sr.status,
          sr.executorType,
          sr.executorConfig,
          sr.dependsOn,
          sr.input,
          sr.scheduledAt,
          sr.attempt,
          sr.maxRetries,
          sr.heartbeatTimeoutMs,
          sr.iterationCount,
          sr.maxIterations,
          sr.requiresLabels,
          sr.createdAt,
          sr.updatedAt,
        )
        idx += 18
      }
      await this.db.query(
        `INSERT INTO ${this.q('workflow_steps')} ${stepCols} VALUES ${stepPlaceholders.join(',')}`,
        stepParams,
      )
    }

    // PG rows exist — emit run.started events before dispatching root steps
    if (this.config.onEngineEvent) {
      for (const { runId, runRow, definition, trigger } of results) {
        this.traceIdCache.set(runId, runRow.traceId)
        this.emitEvent({
          type: 'run.started',
          tenantId: trigger.tenantId,
          runId,
          traceId: runRow.traceId,
          workflowName: trigger.workflowName,
          workflowVersion: definition.version,
        })
      }
    }

    // Dispatch root steps in bulk (one addBulk per target queue)
    const dispatchItems: Array<{
      runId: string
      tenantId: string
      step: WorkflowStep
      definition: WorkflowDefinition
    }> = []
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        dispatchItems.push({
          runId,
          tenantId: trigger.tenantId,
          step: stepRow as any,
          definition,
        })
      }
    }
    await this.dispatchStepsBulk(dispatchItems)

    return results.map(r => ({ runId: r.runId }))
  }

  /**
   * Bulk start workflows using COPY FROM (Hatchet's fastest path).
   * Requires pgPool in engine config. Falls back to startBatch() if not available.
   */
  async startBatchCopy(
    triggers: WorkflowTriggerInput[],
    opts?: { synchronousCommit?: boolean; checkIdempotency?: boolean },
  ): Promise<Array<{ runId: string }>> {
    if (!this.config.pgPool || triggers.length === 0) {
      return this.startBatch(triggers)
    }

    // Idempotency pre-check
    const existingByKey = new Map<string, string>()
    if (opts?.checkIdempotency) {
      const keysByTenant = new Map<string, Set<string>>()
      for (const t of triggers) {
        if (!t.idempotencyKey) {
          continue
        }
        let set = keysByTenant.get(t.tenantId)
        if (!set) {
          set = new Set()
          keysByTenant.set(t.tenantId, set)
        }
        set.add(t.idempotencyKey)
      }
      for (const [tenantId, keys] of keysByTenant) {
        const keysArr = [...keys]
        const placeholders = keysArr.map((_, i) => `$${i + 2}`).join(',')
        const { rows } = await this.db.query<{
          id: string
          idempotencyKey: string
        }>(
          `SELECT id, "idempotencyKey" FROM ${this.q('workflow_runs')} WHERE "tenantId" = $1 AND "idempotencyKey" IN (${placeholders})`,
          [tenantId, ...keysArr],
        )
        for (const r of rows) {
          if (r.idempotencyKey) {
            existingByKey.set(`${tenantId}|${r.idempotencyKey}`, r.id)
          }
        }
      }
    }

    const finalRunIds: string[] = new Array(triggers.length)
    const seenInBatch = new Map<string, string>()
    const results: Array<{
      runId: string
      stepRows: any[]
      definition: WorkflowDefinition
      trigger: WorkflowTriggerInput
      traceId: string
    }> = []
    const runLines: string[] = []
    const stepLines: string[] = []

    // Lazy-init per-engine constants
    if (this.cachedBudgetEsc === null) {
      this.cachedBudgetEsc = esc(toJson(this.config.defaultBudget ?? null))
      this.cachedBudgetUsedEsc = esc(
        toJson({ tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }),
      )
    }
    const budgetEsc = this.cachedBudgetEsc
    const budgetUsedEsc = this.cachedBudgetUsedEsc!

    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i]!
      const definition = this.config.workflows.get(trigger.workflowName)
      if (!definition) {
        throw new WorkflowNotFoundError(trigger.workflowName)
      }

      if (opts?.checkIdempotency && trigger.idempotencyKey) {
        const k = `${trigger.tenantId}|${trigger.idempotencyKey}`
        const dedupedTo = existingByKey.get(k) ?? seenInBatch.get(k)
        if (dedupedTo) {
          finalRunIds[i] = dedupedTo
          continue
        }
      }

      const runId = trigger.runId ?? nanoId(21)
      finalRunIds[i] = runId
      if (opts?.checkIdempotency && trigger.idempotencyKey) {
        seenInBatch.set(`${trigger.tenantId}|${trigger.idempotencyKey}`, runId)
      }
      const now = new Date().toISOString()
      const rootNames = new Set(
        definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name),
      )

      // Reuse pre-stringified + escaped snapshot per (name, version)
      const cacheKey = `${definition.name}@${definition.version}`
      let cached = this.snapshotCache.get(cacheKey)
      if (!cached) {
        const snapshot = toJson({
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
            backoff: s.backoff,
            timeoutMs: s.timeoutMs,
            heartbeatTimeoutMs: s.heartbeatTimeoutMs,
            scheduleToStartTimeoutMs: s.scheduleToStartTimeoutMs,
            requiresHumanApproval: s.requiresHumanApproval,
            stepWeight: s.stepWeight,
            maxIterations: s.maxIterations,
            requiresLabels: s.requiresLabels,
            transactional: s.transactional,
          })),
        })
        const stepEscapes = new Map<
          string,
          { executorConfigEsc: string; dependsOnEsc: string }
        >()
        for (const s of definition.steps) {
          stepEscapes.set(s.name, {
            executorConfigEsc: esc(toJson(s.executorConfig)),
            dependsOnEsc: esc(toJson(s.dependsOn ?? [])),
          })
        }
        cached = { snapshot, snapshotEsc: esc(snapshot), stepEscapes }
        this.snapshotCache.set(cacheKey, cached)
      }
      const snapshotEsc = cached.snapshotEsc

      const triggerInput = toJson(trigger.input)
      const idempKey = trigger.idempotencyKey ?? '\\N'

      const traceId = trigger.traceId ?? nanoId(21)
      runLines.push(
        [
          runId,
          trigger.tenantId,
          trigger.workflowName,
          definition.version,
          'RUNNING',
          snapshotEsc,
          escJson(triggerInput),
          idempKey,
          traceId,
          trigger.parentRunId ?? '\\N',
          trigger.originEventId ?? '\\N',
          budgetEsc,
          budgetUsedEsc,
          now,
          '\\N',
          now,
          now,
        ].join('\t'),
      )

      const localStepRows: any[] = []
      for (const stepDef of definition.steps) {
        const isRoot = rootNames.has(stepDef.name)
        let input: JsonObject = trigger.input as JsonObject
        if (isRoot && stepDef.mapInput) {
          input = stepDef.mapInput({})
        }

        const stepId = nanoId(21)
        const stepRow = {
          id: stepId,
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
          requiresLabels: stepDef.requiresLabels?.length
            ? toJson(stepDef.requiresLabels)
            : null,
        }
        localStepRows.push(stepRow)

        const stepEsc = cached.stepEscapes.get(stepDef.name)!
        const labelsEsc = stepDef.requiresLabels?.length
          ? escJson(toJson(stepDef.requiresLabels))
          : '\\N'
        stepLines.push(
          [
            stepId,
            runId,
            trigger.tenantId,
            stepDef.name,
            isRoot ? 'QUEUED' : 'PENDING',
            stepDef.executorType,
            stepEsc.executorConfigEsc,
            stepEsc.dependsOnEsc,
            isRoot ? escJson(toJson(input)) : '\\N',
            '\\N',
            '\\N',
            0,
            stepDef.retries ?? definition.defaultRetries,
            '\\N',
            '\\N',
            isRoot ? now : '\\N',
            '\\N',
            '\\N',
            stepDef.heartbeatTimeoutMs ?? '\\N',
            '\\N',
            '\\N',
            '\\N',
            '\\N',
            0,
            stepDef.maxIterations ?? '\\N',
            '\\N',
            '\\N',
            '\\N',
            '\\N',
            labelsEsc,
            '\\N', // retryAfterMs
            '\\N', // deadlineEpochMs
            now,
            now,
          ].join('\t'),
        )
      }

      results.push({
        runId,
        stepRows: localStepRows,
        definition,
        trigger,
        traceId,
      })
    }

    if (runLines.length === 0) {
      return finalRunIds.map(id => ({ runId: id }))
    }

    // Execute COPY FROM for both tables in one atomic transaction.
    const client = await this.config.pgPool.connect()
    const tBegin = performance.now()
    try {
      const commitMode = opts?.synchronousCommit ? 'ON' : 'OFF'
      await client.query(`BEGIN; SET LOCAL synchronous_commit = ${commitMode};`)
      const tAfterBegin = performance.now()

      const { from: copyFrom } = await import('pg-copy-streams')
      const runStream = client.query(
        copyFrom(
          `COPY ${this.q('workflow_runs')} (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "startedAt", "completedAt", "createdAt", "updatedAt") FROM STDIN`,
        ),
      )
      runStream.write(`${runLines.join('\n')}\n`)
      runStream.end()
      await new Promise<void>((resolve, reject) => {
        runStream.on('finish', () => resolve())
        runStream.on('error', reject)
      })
      const tAfterRuns = performance.now()

      const stepStream = client.query(
        copyFrom(
          `COPY ${this.q('workflow_steps')} (id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, output, error, attempt, "maxRetries", "startedAt", "completedAt", "scheduledAt", "lastHeartbeatAt", "lastHeartbeatData", "heartbeatTimeoutMs", "humanPrompt", "humanResponse", "humanRespondedBy", "humanRespondedAt", "iterationCount", "maxIterations", "tokensUsed", "costUsd", "modelUsed", "executedBy", "requiresLabels", "retryAfterMs", "deadlineEpochMs", "createdAt", "updatedAt") FROM STDIN`,
        ),
      )
      stepStream.write(`${stepLines.join('\n')}\n`)
      stepStream.end()
      await new Promise<void>((resolve, reject) => {
        stepStream.on('finish', () => resolve())
        stepStream.on('error', reject)
      })
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
          tenantId: trigger.tenantId,
          runId,
          traceId,
          workflowName: trigger.workflowName,
          workflowVersion: definition.version,
        })
      }
    }

    // Dispatch root steps in bulk
    const dispatchItems: Array<{
      runId: string
      tenantId: string
      step: WorkflowStep
      definition: WorkflowDefinition
    }> = []
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        dispatchItems.push({
          runId,
          tenantId: trigger.tenantId,
          step: stepRow as any,
          definition,
        })
      }
    }
    await this.dispatchStepsBulk(dispatchItems)

    return finalRunIds.map(id => ({ runId: id }))
  }

  // ── Step Running ───────────────────────────────────────────────

  async markStepRunning(
    runId: string,
    stepName: string,
    tenantId: string,
    workerIdentity?: string,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    if (!canStepTransition(step.status as StepStatus, 'RUNNING')) {
      return
    }

    if (this.stepStatusBuffer) {
      await this.stepStatusBuffer.enqueue({
        stepId: step.id,
        status: 'RUNNING',
        startedAt: new Date(),
        executedBy: workerIdentity,
      })
    } else {
      await this.updateStepStatus(
        step.id,
        step.status,
        'RUNNING',
        workerIdentity,
      )
    }
    await this.logStepEvent(
      step.id,
      tenantId,
      'started',
      workerIdentity ? { workerIdentity } : undefined,
    )

    if (this.config.onEngineEvent) {
      const traceId = await this.resolveTraceId(runId, tenantId)
      this.emitEvent({
        type: 'step.running',
        tenantId,
        runId,
        traceId,
        stepName,
        attempt: step.attempt,
      })
    }
  }

  /**
   * In-memory cache of runId → traceId, populated on first lookup.
   */
  private traceIdCache = new Map<string, string>()
  /** Deserialized definition snapshots merged with live callbacks, keyed by runId. */
  private definitionForRunCache = new Map<string, WorkflowDefinition>()

  private async resolveTraceId(
    runId: string,
    tenantId: string,
  ): Promise<string> {
    let traceId = this.traceIdCache.get(runId)
    if (traceId) {
      return traceId
    }
    const { rows } = await this.db.query<{ traceId: string | null }>(
      `SELECT "traceId" FROM ${this.q('workflow_runs')} WHERE id = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )
    traceId = rows[0]?.traceId ?? ''
    this.traceIdCache.set(runId, traceId)
    if (this.traceIdCache.size > 5000) {
      const firstKey = this.traceIdCache.keys().next().value
      if (firstKey) {
        this.traceIdCache.delete(firstKey)
      }
    }
    return traceId
  }

  /** Public alias for resolveTraceId — used by WorkflowStepTask for transactional post-commit events. */
  async resolveTraceIdPublic(runId: string, tenantId: string): Promise<string> {
    return this.resolveTraceId(runId, tenantId)
  }

  // ── Step Completion ────────────────────────────────────────────

  async onStepCompleted(
    runId: string,
    stepName: string,
    tenantId: string,
    result: StepResult,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    if (result.waitForHuman) {
      if (
        this.stepStatusBuffer &&
        canStepTransition(step.status as StepStatus, 'WAITING_HUMAN')
      ) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'WAITING_HUMAN',
          output: toJson(result.output),
          humanPrompt: toJson(result.waitForHuman),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'WAITING_HUMAN')
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET output = $1, "humanPrompt" = $2, "updatedAt" = $3 WHERE id = $4`,
          [
            toJson(result.output),
            toJson(result.waitForHuman),
            new Date(),
            step.id,
          ],
        )
      }
      await this.logStepEvent(step.id, tenantId, 'human_requested', {
        prompt: result.waitForHuman.prompt,
      })
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.human_requested',
          tenantId,
          runId,
          traceId,
          stepName,
          prompt: result.waitForHuman.prompt,
          schema: result.waitForHuman.schema,
        })
      }
    } else {
      if (
        this.stepStatusBuffer &&
        canStepTransition(step.status as StepStatus, 'COMPLETED')
      ) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'COMPLETED',
          output: toJson(result.output),
          completedAt: new Date(),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'COMPLETED')
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET output = $1, "completedAt" = $2, "updatedAt" = $3 WHERE id = $4`,
          [toJson(result.output), new Date(), new Date(), step.id],
        )
      }
      await this.logStepEvent(step.id, tenantId, 'completed', {
        outputKeys: Object.keys(result.output),
      })
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.completed',
          tenantId,
          runId,
          traceId,
          stepName,
          output: result.output,
        })
      }
    }

    // ── Budget enforcement: increment step counter ──────
    if (!result.waitForHuman) {
      const budgetExceeded = await this.incrementBudgetUsage(runId, 'steps')
      if (budgetExceeded) {
        this.config.logger?.warn(
          `Budget exceeded for run ${runId}: ${budgetExceeded}`,
        )
        await this.db.query(
          `UPDATE ${this.q('workflow_runs')} SET status = $1, error = $2, "completedAt" = $3, "updatedAt" = $4 WHERE id = $5`,
          ['FAILED', budgetExceeded, new Date(), new Date(), runId],
        )
        return
      }

      const usage = result.output?._usage as Record<string, unknown> | undefined
      if (usage) {
        if (typeof usage.tokens === 'number') {
          const tokenExceeded = await this.incrementBudgetUsage(
            runId,
            'tokens',
            usage.tokens,
          )
          if (tokenExceeded) {
            this.config.logger?.warn(
              `Budget exceeded for run ${runId}: ${tokenExceeded}`,
            )
            await this.db.query(
              `UPDATE ${this.q('workflow_runs')} SET status = $1, error = $2, "completedAt" = $3, "updatedAt" = $4 WHERE id = $5`,
              ['FAILED', tokenExceeded, new Date(), new Date(), runId],
            )
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
      const targetStepDef = definition.steps.find(
        s => s.name === result.nextStep,
      )
      if (!targetStepDef) {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, error = $2, "updatedAt" = $3 WHERE id = $4`,
          [
            'FAILED',
            `nextStep target "${result.nextStep}" does not exist in workflow "${definition.name}"`,
            new Date(),
            step.id,
          ],
        )
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      const targetStep = await this.getStep(runId, result.nextStep, tenantId)
      const currentIteration = (targetStep as any).iterationCount ?? 0
      const maxIter = (targetStep as any).maxIterations ?? 100

      if (currentIteration >= maxIter) {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, error = $2, "updatedAt" = $3 WHERE id = $4`,
          [
            'FAILED',
            `Step "${result.nextStep}" exceeded max iterations (${maxIter})`,
            new Date(),
            step.id,
          ],
        )
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      await this.db.query(
        `UPDATE ${this.q('workflow_steps')} SET status = $1, output = $2, error = $3, "completedAt" = $4, "startedAt" = $5, "iterationCount" = $6, "updatedAt" = $7 WHERE id = $8`,
        [
          'PENDING',
          null,
          null,
          null,
          null,
          currentIteration + 1,
          new Date(),
          targetStep.id,
        ],
      )

      await this.dispatchReadySteps(runId, tenantId, definition)
      return
    }

    await this.advanceWorkflow(runId, tenantId, definition)
  }

  /**
   * Post-commit work for transactional steps: budget enforcement,
   * nextStep loops, and DAG advancement. Called by WorkflowStepTask
   * AFTER the transactional COMMIT so these operations run outside
   * the step's transaction boundary.
   */
  async postStepCompleted(
    runId: string,
    stepName: string,
    tenantId: string,
    result: StepResult,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    // Budget enforcement
    const budgetExceeded = await this.incrementBudgetUsage(runId, 'steps')
    if (budgetExceeded) {
      this.config.logger?.warn(
        `Budget exceeded for run ${runId}: ${budgetExceeded}`,
      )
      await this.db.query(
        `UPDATE ${this.q('workflow_runs')} SET status = $1, error = $2, "completedAt" = $3, "updatedAt" = $4 WHERE id = $5`,
        ['FAILED', budgetExceeded, new Date(), new Date(), runId],
      )
      return
    }

    const usage = result.output?._usage as Record<string, unknown> | undefined
    if (usage) {
      if (typeof usage.tokens === 'number') {
        const tokenExceeded = await this.incrementBudgetUsage(
          runId,
          'tokens',
          usage.tokens,
        )
        if (tokenExceeded) {
          this.config.logger?.warn(
            `Budget exceeded for run ${runId}: ${tokenExceeded}`,
          )
          await this.db.query(
            `UPDATE ${this.q('workflow_runs')} SET status = $1, error = $2, "completedAt" = $3, "updatedAt" = $4 WHERE id = $5`,
            ['FAILED', tokenExceeded, new Date(), new Date(), runId],
          )
          return
        }
      }
      if (typeof usage.costUsd === 'number') {
        await this.incrementBudgetUsage(runId, 'costUsd', usage.costUsd)
      }
    }

    // nextStep runtime redirect
    if (result.nextStep) {
      const targetStepDef = definition.steps.find(
        s => s.name === result.nextStep,
      )
      if (!targetStepDef) {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, error = $2, "updatedAt" = $3 WHERE id = $4`,
          [
            'FAILED',
            `nextStep target "${result.nextStep}" does not exist in workflow "${definition.name}"`,
            new Date(),
            step.id,
          ],
        )
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      const targetStep = await this.getStep(runId, result.nextStep, tenantId)
      const currentIteration = (targetStep as any).iterationCount ?? 0
      const maxIter = (targetStep as any).maxIterations ?? 100

      if (currentIteration >= maxIter) {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, error = $2, "updatedAt" = $3 WHERE id = $4`,
          [
            'FAILED',
            `Step "${result.nextStep}" exceeded max iterations (${maxIter})`,
            new Date(),
            step.id,
          ],
        )
        await this.advanceWorkflow(runId, tenantId, definition)
        return
      }

      await this.db.query(
        `UPDATE ${this.q('workflow_steps')} SET status = $1, output = $2, error = $3, "completedAt" = $4, "startedAt" = $5, "iterationCount" = $6, "updatedAt" = $7 WHERE id = $8`,
        [
          'PENDING',
          null,
          null,
          null,
          null,
          currentIteration + 1,
          new Date(),
          targetStep.id,
        ],
      )

      await this.dispatchReadySteps(runId, tenantId, definition)
      return
    }

    await this.advanceWorkflow(runId, tenantId, definition)
  }

  // ── Step Failure ───────────────────────────────────────────────

  async onStepFailed(
    runId: string,
    stepName: string,
    tenantId: string,
    error: Error,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    const isNonRetryable = error instanceof NonRetryableError
    const canRetry = !isNonRetryable && step.attempt < step.maxRetries

    if (canRetry) {
      const stepDef = definition.steps.find(s => s.name === stepName)
      const backoff = stepDef?.backoff
      const retryAfterMs = computeRetryDelay(backoff, step.attempt)

      await this.updateStepStatus(step.id, step.status, 'QUEUED')
      await this.db.query(
        `UPDATE ${this.q('workflow_steps')} SET attempt = $1, error = $2, "startedAt" = $3, "updatedAt" = $4, "retryAfterMs" = $5 WHERE id = $6`,
        [
          step.attempt + 1,
          error.message,
          null,
          new Date(),
          retryAfterMs,
          step.id,
        ],
      )
      await this.logStepEvent(step.id, tenantId, 'retried', {
        attempt: step.attempt + 1,
        error: error.message,
        ...(retryAfterMs
          ? { retryAfterMs, delayMs: retryAfterMs - Date.now() }
          : {}),
      })
      // When no backoff, dispatch immediately (original behavior).
      // With backoff, the PgConnector poll will pick it up after retryAfterMs.
      if (!retryAfterMs) {
        await this.dispatchStep(runId, tenantId, step, definition)
      }
    } else {
      if (
        this.stepStatusBuffer &&
        canStepTransition(step.status as StepStatus, 'FAILED')
      ) {
        await this.stepStatusBuffer.enqueue({
          stepId: step.id,
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        })
      } else {
        await this.updateStepStatus(step.id, step.status, 'FAILED')
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET error = $1, "completedAt" = $2, "updatedAt" = $3 WHERE id = $4`,
          [error.message, new Date(), new Date(), step.id],
        )
      }
      await this.logStepEvent(step.id, tenantId, 'failed', {
        attempt: step.attempt,
        error: error.message,
        nonRetryable: isNonRetryable,
      })
      if (this.config.onEngineEvent) {
        const traceId = await this.resolveTraceId(runId, tenantId)
        this.emitEvent({
          type: 'step.failed',
          tenantId,
          runId,
          traceId,
          stepName,
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
    const step = await this.getStep(
      input.workflowRunId,
      input.stepName,
      input.tenantId,
    )

    if (step.status !== 'WAITING_HUMAN') {
      throw new HumanInputError(
        `Step "${input.stepName}" is not waiting for human input (status: ${step.status})`,
        { stepName: input.stepName, status: step.status },
      )
    }

    const definition = await this.getDefinitionForRun(input.workflowRunId)

    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET "humanResponse" = $1, "humanRespondedBy" = $2, "humanRespondedAt" = $3, "updatedAt" = $4 WHERE id = $5`,
      [
        toJson(input.data),
        input.respondedBy ?? null,
        new Date(),
        new Date(),
        step.id,
      ],
    )

    await this.logStepEvent(step.id, input.tenantId, 'human_responded', {
      respondedBy: input.respondedBy,
    })

    await this.updateStepStatus(step.id, step.status, 'COMPLETED')
    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET "completedAt" = $1, "updatedAt" = $2 WHERE id = $3`,
      [new Date(), new Date(), step.id],
    )

    await this.advanceWorkflow(input.workflowRunId, input.tenantId, definition)
  }

  // ── Cancel ─────────────────────────────────────────────────────

  async cancel(runId: string, tenantId: string): Promise<void> {
    const run = await this.getRun(runId, tenantId)
    if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
      return
    }

    await this.updateRunStatus(runId, 'CANCELLED')

    const { rows: steps } = await this.db.query<WorkflowStep>(
      `SELECT * FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )

    for (const step of steps) {
      if (
        step.status === 'PENDING' ||
        step.status === 'QUEUED' ||
        step.status === 'WAITING_HUMAN'
      ) {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, "updatedAt" = $2 WHERE id = $3`,
          ['SKIPPED', new Date(), step.id],
        )
        await this.logStepEvent(step.id, tenantId, 'cancelled')
      }
    }
  }

  // ── Retry ──────────────────────────────────────────────────────

  async retry(runId: string, tenantId: string): Promise<void> {
    const run = await this.getRun(runId, tenantId)
    if (run.status === 'COMPLETED') {
      throw new Error(`Cannot retry completed run ${runId}`)
    }

    const definition = this.config.workflows.get(run.workflowName)
    if (!definition) {
      throw new Error(`Workflow "${run.workflowName}" not found in engine`)
    }

    await this.db.query(
      `UPDATE ${this.q('workflow_runs')} SET status = $1, error = $2, "startedAt" = $3, "completedAt" = $4, "updatedAt" = $5 WHERE id = $6`,
      ['RUNNING', null, new Date(), null, new Date(), runId],
    )

    const { rows: steps } = await this.db.query<WorkflowStep>(
      `SELECT * FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )

    const rootNames = new Set(
      definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name),
    )
    const stepsToDispatch: typeof steps = []

    for (const step of steps) {
      if (step.status === 'COMPLETED') {
        continue
      }

      const isRoot = rootNames.has(step.stepName)
      const shouldDispatch =
        isRoot ||
        definition.steps
          .find(s => s.name === step.stepName)
          ?.dependsOn?.every(
            dep => steps.find(s => s.stepName === dep)?.status === 'COMPLETED',
          )

      await this.db.query(
        `UPDATE ${this.q('workflow_steps')} SET status = $1, error = $2, output = $3, "startedAt" = $4, "completedAt" = $5, "scheduledAt" = $6, attempt = $7, "updatedAt" = $8 WHERE id = $9`,
        [
          shouldDispatch ? 'QUEUED' : 'PENDING',
          null,
          null,
          null,
          null,
          shouldDispatch ? new Date() : null,
          step.attempt + 1,
          new Date(),
          step.id,
        ],
      )

      await this.logStepEvent(step.id, tenantId, 'retried')

      if (shouldDispatch) {
        stepsToDispatch.push({
          ...step,
          attempt: step.attempt + 1,
          status: 'QUEUED',
        })
      }
    }

    await this.dispatchStepsBulk(
      stepsToDispatch.map(step => ({
        runId,
        tenantId,
        step: step as any,
        definition,
      })),
    )
  }

  // ── Query ──────────────────────────────────────────────────────

  async listWorkflows(
    tenantId: string,
    filters?: {
      status?: string[]
      workflowName?: string
      limit?: number
      offset?: number
    },
  ): Promise<
    Array<WorkflowRun & { stepCount: number; completedStepCount: number }>
  > {
    let whereClause = `"tenantId" = $1`
    const params: any[] = [tenantId]
    let paramIdx = 2

    if (filters?.status?.length) {
      const placeholders = filters.status
        .map((_, i) => `$${paramIdx + i}`)
        .join(',')
      whereClause += ` AND status IN (${placeholders})`
      params.push(...filters.status)
      paramIdx += filters.status.length
    }
    if (filters?.workflowName) {
      whereClause += ` AND "workflowName" = $${paramIdx}`
      params.push(filters.workflowName)
      paramIdx++
    }

    let queryStr = `SELECT * FROM ${this.q('workflow_runs')} WHERE ${whereClause} ORDER BY "createdAt" DESC`
    if (filters?.limit) {
      queryStr += ` LIMIT $${paramIdx}`
      params.push(filters.limit)
      paramIdx++
    }
    if (filters?.offset) {
      queryStr += ` OFFSET $${paramIdx}`
      params.push(filters.offset)
      paramIdx++
    }

    const { rows: runs } = await this.db.query<WorkflowRun>(queryStr, params)

    if (runs.length === 0) {
      return []
    }

    // DBOS-parity: single aggregate query replaces N+1 per-run step lookups
    const runIds = runs.map(r => r.id)
    const idPlaceholders = runIds.map((_, i) => `$${i + 1}`).join(',')
    const { rows: stepCounts } = await this.db.query<{
      workflowRunId: string
      stepCount: number
      completedStepCount: number
    }>(
      `SELECT "workflowRunId", count(*)::int AS "stepCount", count(*) FILTER (WHERE status IN ('COMPLETED', 'SKIPPED'))::int AS "completedStepCount" FROM ${this.q('workflow_steps')} WHERE "workflowRunId" IN (${idPlaceholders}) GROUP BY "workflowRunId"`,
      runIds,
    )

    const countMap = new Map(
      stepCounts.map(r => [
        r.workflowRunId,
        { stepCount: r.stepCount, completedStepCount: r.completedStepCount },
      ]),
    )

    return runs.map(run => ({
      ...run,
      triggerInput: run.triggerInput
        ? (fromJson(run.triggerInput) as any)
        : null,
      output: run.output ? (fromJson(run.output) as any) : null,
      stepCount: countMap.get(run.id)?.stepCount ?? 0,
      completedStepCount: countMap.get(run.id)?.completedStepCount ?? 0,
    }))
  }

  async getStatus(
    runId: string,
    tenantId: string,
  ): Promise<WorkflowRun & { steps: WorkflowStep[] }> {
    const run = await this.getRun(runId, tenantId)
    const { rows: steps } = await this.db.query<WorkflowStep>(
      `SELECT * FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )
    return {
      ...run,
      triggerInput: run.triggerInput
        ? (fromJson(run.triggerInput) as any)
        : null,
      output: run.output ? (fromJson(run.output) as any) : null,
      steps: steps.map(s => ({
        ...s,
        input: s.input ? (fromJson(s.input) as any) : null,
        output: s.output ? (fromJson(s.output) as any) : null,
        executorConfig: s.executorConfig
          ? (fromJson(s.executorConfig) as any)
          : null,
        lastHeartbeatData: s.lastHeartbeatData
          ? (fromJson(s.lastHeartbeatData) as any)
          : null,
        dependsOn: s.dependsOn ? (fromJson(s.dependsOn) as any) : [],
        humanPrompt: s.humanPrompt ? (fromJson(s.humanPrompt) as any) : null,
        humanResponse: s.humanResponse
          ? (fromJson(s.humanResponse) as any)
          : null,
      })),
    }
  }

  getExecutor(type: string): StepExecutor | undefined {
    return this.config.executors.get(type)
  }

  // ── Trace ──────────────────────────────────────────────────────

  async getTrace(traceId: string): Promise<{
    runs: WorkflowRun[]
    events: import('../entities/Database.js').WorkflowEvent[]
    actions: import('../entities/Database.js').ExternalAction[]
  }> {
    const [runsRes, eventsRes, actionsRes] = await Promise.all([
      this.db.query<WorkflowRun>(
        `SELECT * FROM ${this.q('workflow_runs')} WHERE "traceId" = $1`,
        [traceId],
      ),
      this.db.query<import('../entities/Database.js').WorkflowEvent>(
        `SELECT * FROM ${this.q('workflow_events')} WHERE "traceId" = $1`,
        [traceId],
      ),
      this.db.query<import('../entities/Database.js').ExternalAction>(
        `SELECT * FROM ${this.q('external_actions')} WHERE "traceId" = $1`,
        [traceId],
      ),
    ])
    return {
      runs: runsRes.rows,
      events: eventsRes.rows,
      actions: actionsRes.rows,
    }
  }

  // ── Heartbeat ──────────────────────────────────────────────────

  async heartbeat(
    runId: string,
    stepName: string,
    tenantId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET "lastHeartbeatAt" = $1, "lastHeartbeatData" = $2, "updatedAt" = $3 WHERE id = $4`,
      [new Date(), toJson(data ?? null), new Date(), step.id],
    )
    await this.logStepEvent(step.id, tenantId, 'heartbeat', data)
  }

  // ── Signals ────────────────────────────────────────────────────

  async signal(
    runId: string,
    tenantId: string,
    signalName: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const run = await this.getRun(runId, tenantId)
    const definition = this.config.workflows.get(run.workflowName)

    await this.db.query(
      `INSERT INTO ${this.q('workflow_signals')} (id, "workflowRunId", "tenantId", "signalName", data, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)`,
      [nanoId(21), runId, tenantId, signalName, toJson(data)!, new Date()],
    )

    if (definition?.signals?.[signalName]) {
      const steps = await this.findSteps(runId, tenantId)
      const ctx = this.buildStepContext(run, steps)
      await definition.signals[signalName].handler(ctx, data as any)

      await this.db.query(
        `UPDATE ${this.q('workflow_signals')} SET "processedAt" = $1 WHERE "workflowRunId" = $2 AND "signalName" = $3 AND "processedAt" IS NULL`,
        [new Date(), runId, signalName],
      )
    }

    if (run.status === 'WAITING_HUMAN' && definition) {
      await this.advanceWorkflow(runId, tenantId, definition)
    }
  }

  // ── Queries ────────────────────────────────────────────────────

  async query(
    runId: string,
    tenantId: string,
    queryName: string,
  ): Promise<Record<string, unknown>> {
    const run = await this.getRun(runId, tenantId)
    const definition = this.config.workflows.get(run.workflowName)

    if (!definition?.queries?.[queryName]) {
      throw new WorkflowError(
        `No query handler registered for "${queryName}"`,
        'QUERY_NOT_FOUND',
        { queryName },
      )
    }

    const steps = await this.findSteps(runId, tenantId)
    const ctx = this.buildStepContext(run, steps)
    const result = await definition.queries[queryName].handler(ctx)
    return result as Record<string, unknown>
  }

  // ── Internal Helpers ───────────────────────────────────────────

  private async advanceWorkflow(
    runId: string,
    tenantId: string,
    definition: WorkflowDefinition,
  ): Promise<void> {
    const steps = await this.findSteps(runId, tenantId)
    const newStatus = deriveWorkflowStatus(
      steps.map(s => ({ status: s.status as StepStatus })),
    )
    const run = await this.getRun(runId, tenantId)

    if (
      newStatus !== run.status &&
      canWorkflowTransition(run.status as WorkflowStatus, newStatus)
    ) {
      if (newStatus === 'COMPLETED') {
        const mergedOutput = this.mergeStepOutputs(steps)
        await this.db.query(
          `UPDATE ${this.q('workflow_runs')} SET status = $1, "completedAt" = $2, output = $3, "updatedAt" = $4 WHERE id = $5`,
          [newStatus, new Date(), toJson(mergedOutput), new Date(), runId],
        )
        if (definition.onComplete) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onComplete(ctx)
        }
        this.emitEvent({
          type: 'run.completed',
          tenantId,
          runId,
          traceId: run.traceId ?? '',
          status: 'COMPLETED',
          output: mergedOutput,
        })
        this.traceIdCache.delete(runId)
        this.definitionForRunCache.delete(runId)
      } else if (newStatus === 'FAILED') {
        const failedStep = steps.find(s => s.status === 'FAILED')
        const errorMsg = failedStep?.error ?? 'Unknown error'
        await this.db.query(
          `UPDATE ${this.q('workflow_runs')} SET status = $1, "completedAt" = $2, error = $3, "updatedAt" = $4 WHERE id = $5`,
          [newStatus, new Date(), errorMsg, new Date(), runId],
        )
        // Saga rollback: compensate completed steps in reverse topological order.
        // History is append-only — step status stays COMPLETED, rollback is logged as events.
        await this.executeRollbacks(runId, tenantId, definition, steps)
        if (definition.onFail) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onFail(ctx, new Error(errorMsg))
        }
        this.emitEvent({
          type: 'run.completed',
          tenantId,
          runId,
          traceId: run.traceId ?? '',
          status: 'FAILED',
          error: errorMsg,
        })
        this.traceIdCache.delete(runId)
        this.definitionForRunCache.delete(runId)
      } else {
        await this.updateRunStatus(runId, newStatus)
      }
    }

    if (newStatus === 'RUNNING') {
      await this.dispatchReadySteps(runId, tenantId, definition)
    }
  }

  private async dispatchReadySteps(
    runId: string,
    tenantId: string,
    definition: WorkflowDefinition,
  ): Promise<void> {
    const steps = await this.findSteps(runId, tenantId)
    const statuses: Record<string, StepStatus> = {}
    for (const step of steps) {
      statuses[step.stepName] = step.status as StepStatus
    }

    const readyNames = getReadySteps(definition.steps, statuses)

    for (const name of readyNames) {
      if (this.config.maxConcurrentStepsPerWorkflow) {
        const { rows: countRows } = await this.db.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND status IN ('QUEUED', 'RUNNING')`,
          [runId],
        )
        if (
          Number(countRows[0]?.count ?? 0) >=
          this.config.maxConcurrentStepsPerWorkflow
        ) {
          return
        }
      }
      const stepDef = definition.steps.find(s => s.name === name)!
      const stepRow = steps.find(s => s.stepName === name)!

      if (stepDef.condition) {
        const run = await this.getRun(runId, tenantId)
        const ctx = this.buildStepContext(run, steps)
        const shouldRun = await stepDef.condition(ctx)
        if (!shouldRun) {
          await this.db.query(
            `UPDATE ${this.q('workflow_steps')} SET status = $1, "updatedAt" = $2 WHERE id = $3`,
            ['SKIPPED', new Date(), stepRow.id],
          )
          await this.logStepEvent(stepRow.id, tenantId, 'skipped')
          await this.advanceWorkflow(runId, tenantId, definition)
          return
        }
      }

      let input: JsonObject = {}
      if (stepDef.mapInput) {
        // Explicit mapping — call user-provided transform
        const completedOutputs: Record<string, JsonObject> = {}
        for (const s of steps) {
          if (s.status === 'COMPLETED' && s.output) {
            completedOutputs[s.stepName] = fromJson(s.output) as JsonObject
          }
        }
        const run = await this.getRun(runId, tenantId)
        completedOutputs.__trigger = (fromJson(run.triggerInput) ??
          {}) as JsonObject
        input = stepDef.mapInput(completedOutputs)
      } else if (stepDef.dependsOn?.length) {
        // Auto-pass: pipe upstream output(s) into this step's input.
        // Single dep → pass output directly (structural typing handles partial match).
        // Multiple deps → merge keyed by step name: { step_a: outputA, step_b: outputB }.
        if (stepDef.dependsOn.length === 1) {
          const depStep = steps.find(s => s.stepName === stepDef.dependsOn![0])
          input = depStep?.output
            ? (fromJson(depStep.output) as JsonObject)
            : {}
        } else {
          const merged: JsonObject = {}
          for (const depName of stepDef.dependsOn) {
            const depStep = steps.find(s => s.stepName === depName)
            if (depStep?.output) {
              ;(merged as any)[depName] = fromJson(depStep.output) as JsonObject
            }
          }
          input = merged
        }
      } else {
        // Root step — gets trigger input
        const run = await this.getRun(runId, tenantId)
        input = (fromJson(run.triggerInput) ?? {}) as JsonObject
      }

      await this.db.query(
        `UPDATE ${this.q('workflow_steps')} SET input = $1, "scheduledAt" = $2, status = $3, "updatedAt" = $4 WHERE id = $5`,
        [toJson(input), new Date(), 'QUEUED', new Date(), stepRow.id],
      )
      await this.logStepEvent(stepRow.id, tenantId, 'queued')

      // Re-fetch after update for dispatch
      const { rows: freshRows } = await this.db.query<WorkflowStep>(
        `SELECT * FROM ${this.q('workflow_steps')} WHERE id = $1`,
        [stepRow.id],
      )
      const freshStep = freshRows[0]
      if (freshStep) {
        await this.dispatchStep(runId, tenantId, freshStep, definition)
      }
    }
  }

  private async dispatchStepsBulk(
    items: Array<{
      runId: string
      tenantId: string
      step: WorkflowStep
      definition: WorkflowDefinition
    }>,
  ): Promise<void> {
    if (items.length === 0) {
      return
    }

    const QUEUE_MAP: Record<string, string> = {
      light: 'workflow_step_light',
      heavy: 'workflow_step_heavy',
      ai: 'workflow_step_ai',
      sandbox: 'workflow_step_sandbox',
    }

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
        lastHeartbeatData: fromJson(step.lastHeartbeatData) as
          | JsonObject
          | undefined,
        heartbeatTimeoutMs: step.heartbeatTimeoutMs ?? undefined,
        scheduleToStartTimeoutMs: stepDef.scheduleToStartTimeoutMs ?? undefined,
        requiresLabels: stepDef.requiresLabels,
        transactional: stepDef.transactional,
      }
      const iterCount = (step as any).iterationCount ?? 0
      const jobId = `wf-${runId}-${step.stepName}-${step.attempt}-i${iterCount}`
      const queueName =
        QUEUE_MAP[stepDef.stepWeight ?? 'light'] ?? 'workflow_step_light'

      jobs.push({
        uniqueTaskName: jobId,
        taskName: queueName,
        taskBody: payload as object,
        opts: { removeOnComplete: true, removeOnFail: 100 },
      })
    }

    if (!this.config.connector) {
      return
    }

    if (typeof this.config.connector.bulkQueue === 'function') {
      await this.config.connector.bulkQueue(jobs)
      return
    }

    await Promise.all(
      items.map(it =>
        this.dispatchStep(it.runId, it.tenantId, it.step, it.definition),
      ),
    )
  }

  private async dispatchStep(
    runId: string,
    tenantId: string,
    step: WorkflowStep,
    definition: WorkflowDefinition,
  ): Promise<void> {
    const stepDef = definition.steps.find(s => s.name === step.stepName)!

    const payload: StepPayload = {
      workflowRunId: runId,
      stepName: step.stepName,
      tenantId,
      input: (fromJson(step.input) ?? {}) as JsonObject,
      attempt: step.attempt,
      executorType: step.executorType,
      executorConfig: (fromJson(step.executorConfig) ?? {}) as JsonObject,
      lastHeartbeatData: fromJson(step.lastHeartbeatData) as
        | JsonObject
        | undefined,
      heartbeatTimeoutMs: step.heartbeatTimeoutMs ?? undefined,
      scheduleToStartTimeoutMs: stepDef.scheduleToStartTimeoutMs ?? undefined,
      requiresLabels: stepDef.requiresLabels,
      transactional: stepDef.transactional,
    }

    const iterCount = (step as any).iterationCount ?? 0
    const jobId = `wf-${runId}-${step.stepName}-${step.attempt}-i${iterCount}`
    const QUEUE_MAP: Record<string, string> = {
      light: 'workflow_step_light',
      heavy: 'workflow_step_heavy',
      ai: 'workflow_step_ai',
      sandbox: 'workflow_step_sandbox',
    }
    const queueName =
      QUEUE_MAP[stepDef.stepWeight ?? 'light'] ?? 'workflow_step_light'

    if (!this.config.connector) {
      return
    }

    await this.config.connector.queue({
      uniqueTaskName: jobId,
      taskName: queueName,
      postUrl: '/workflow/step',
      taskBody: payload,
      handle: async () => {},
    })
  }

  private async updateRunStatus(
    runId: string,
    status: WorkflowStatus | string,
  ): Promise<void> {
    if (status === 'RUNNING') {
      await this.db.query(
        `UPDATE ${this.q('workflow_runs')} SET status = $1, "startedAt" = $2, "updatedAt" = $3 WHERE id = $4`,
        [status, new Date(), new Date(), runId],
      )
    } else {
      await this.db.query(
        `UPDATE ${this.q('workflow_runs')} SET status = $1, "updatedAt" = $2 WHERE id = $3`,
        [status, new Date(), runId],
      )
    }
  }

  private async updateStepStatus(
    stepId: string,
    currentStatus: string,
    newStatus: StepStatus,
    workerIdentity?: string,
  ): Promise<void> {
    if (canStepTransition(currentStatus as StepStatus, newStatus)) {
      if (newStatus === 'RUNNING') {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, "startedAt" = $2, "updatedAt" = $3${workerIdentity ? ', "executedBy" = $5' : ''} WHERE id = $4`,
          workerIdentity
            ? [newStatus, new Date(), new Date(), stepId, workerIdentity]
            : [newStatus, new Date(), new Date(), stepId],
        )
      } else {
        await this.db.query(
          `UPDATE ${this.q('workflow_steps')} SET status = $1, "updatedAt" = $2 WHERE id = $3`,
          [newStatus, new Date(), stepId],
        )
      }
    }
  }

  async logStepEvent(
    stepId: string,
    tenantId: string,
    event: string,
    data?: Record<string, unknown>,
    workflowRunId?: string,
  ): Promise<void> {
    const entry = {
      id: nanoId(21),
      stepId,
      workflowRunId: workflowRunId ?? null,
      tenantId,
      event,
      data,
    }

    if (this.config.disableLogBuffering || !this.logBuffer) {
      await this.db.query(
        `INSERT INTO ${this.q('workflow_step_logs')} (id, "stepId", "workflowRunId", "tenantId", event, data, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          entry.id,
          entry.stepId,
          entry.workflowRunId,
          entry.tenantId,
          entry.event,
          toJson(entry.data ?? null),
          new Date(),
        ],
      )
      return
    }

    this.logBuffer.enqueue(entry)
  }

  private async writeLogBatch(
    batch: Array<{
      id: string
      stepId: string
      workflowRunId: string | null
      tenantId: string
      event: string
      data?: Record<string, unknown>
    }>,
  ): Promise<void> {
    if (batch.length === 0) {
      return
    }
    const now = new Date().toISOString()

    if (this.config.pgPool) {
      const lines = `${batch
        .map(e =>
          [
            e.id,
            e.stepId,
            e.workflowRunId ?? '\\N',
            e.tenantId,
            e.event,
            esc(toJson(e.data ?? null)),
            now,
          ].join('\t'),
        )
        .join('\n')}\n`

      const client = await this.config.pgPool.connect()
      try {
        const { from: copyFrom } = await import('pg-copy-streams')
        const stream = client.query(
          copyFrom(
            `COPY ${this.q('workflow_step_logs')} (id, "stepId", "workflowRunId", "tenantId", event, data, "createdAt") FROM STDIN`,
          ),
        )
        stream.write(lines)
        stream.end()
        await new Promise<void>((resolve, reject) => {
          stream.on('finish', () => resolve())
          stream.on('error', reject)
        })
      } finally {
        client.release()
      }
      return
    }

    // Fallback: multi-row INSERT
    const cols = `(id, "stepId", "workflowRunId", "tenantId", event, data, "createdAt")`
    const placeholders: string[] = []
    const params: any[] = []
    let idx = 1
    for (const e of batch) {
      placeholders.push(
        `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6})`,
      )
      params.push(
        e.id,
        e.stepId,
        e.workflowRunId,
        e.tenantId,
        e.event,
        toJson(e.data ?? null),
        new Date(),
      )
      idx += 7
    }
    await this.db.query(
      `INSERT INTO ${this.q('workflow_step_logs')} ${cols} VALUES ${placeholders.join(',')}`,
      params,
    )
  }

  private async getRun(runId: string, tenantId: string): Promise<WorkflowRun> {
    const { rows } = await this.db.query<WorkflowRun>(
      `SELECT * FROM ${this.q('workflow_runs')} WHERE id = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )
    if (!rows[0]) {
      throw new WorkflowRunNotFoundError(runId)
    }
    return rows[0]
  }

  private async getStep(
    runId: string,
    stepName: string,
    tenantId: string,
  ): Promise<WorkflowStep> {
    const { rows } = await this.db.query<WorkflowStep>(
      `SELECT * FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND "stepName" = $2 AND "tenantId" = $3`,
      [runId, stepName, tenantId],
    )
    if (!rows[0]) {
      throw new WorkflowRunNotFoundError(
        `Step "${stepName}" in run "${runId}" not found`,
      )
    }
    return rows[0]
  }

  private async findSteps(
    runId: string,
    tenantId: string,
  ): Promise<WorkflowStep[]> {
    const { rows } = await this.db.query<WorkflowStep>(
      `SELECT * FROM ${this.q('workflow_steps')} WHERE "workflowRunId" = $1 AND "tenantId" = $2`,
      [runId, tenantId],
    )
    return rows
  }

  private async getDefinitionForRun(
    runId: string,
  ): Promise<WorkflowDefinition> {
    const cached = this.definitionForRunCache.get(runId)
    if (cached) {
      return cached
    }

    const { rows } = await this.db.query<{
      workflowName: string
      definitionSnapshot: string | null
    }>(
      `SELECT "workflowName", "definitionSnapshot" FROM ${this.q('workflow_runs')} WHERE id = $1`,
      [runId],
    )
    if (!rows[0]) {
      throw new WorkflowRunNotFoundError(runId)
    }

    const liveDef = this.config.workflows.get(rows[0].workflowName)
    const snapshot = fromJson<WorkflowDefinition>(rows[0].definitionSnapshot)

    // If no snapshot (legacy runs before snapshots existed), fall back to live.
    if (!snapshot) {
      if (!liveDef) {
        throw new WorkflowNotFoundError(rows[0].workflowName)
      }
      return liveDef
    }

    // Merge: snapshot provides frozen structure (step topology, retries, config);
    // live registry provides non-serializable callbacks (condition, mapInput,
    // onComplete, onFail). If the workflow was removed from the registry, we
    // use the snapshot alone (callbacks will be undefined — steps still run,
    // just without conditional logic or input mapping).
    const liveStepMap = new Map((liveDef?.steps ?? []).map(s => [s.name, s]))
    const mergedSteps = snapshot.steps.map(snapshotStep => {
      const liveStep = liveStepMap.get(snapshotStep.name)
      return {
        ...snapshotStep,
        // Non-serializable callbacks from live code (if step still exists)
        condition: liveStep?.condition,
        mapInput: liveStep?.mapInput,
      }
    })

    const merged: WorkflowDefinition = {
      ...snapshot,
      steps: mergedSteps,
      // Non-serializable workflow-level callbacks
      onComplete: liveDef?.onComplete,
      onFail: liveDef?.onFail,
      onRollbackFailed: liveDef?.onRollbackFailed,
      signals: liveDef?.signals,
      queries: liveDef?.queries,
      inputSchema: liveDef?.inputSchema,
    }

    this.definitionForRunCache.set(runId, merged)
    return merged
  }

  // ── Saga Rollback ───────────────────────────────────────────

  /**
   * Execute rollback handlers for completed steps in reverse topological order.
   * Append-only: step status stays COMPLETED; rollback is logged as events.
   * Best-effort: if a rollback throws, log the error and continue with remaining.
   */
  private async executeRollbacks(
    runId: string,
    tenantId: string,
    definition: WorkflowDefinition,
    steps: WorkflowStep[],
  ): Promise<void> {
    if (!this.config.rollbackHandlers?.size) {
      return
    }

    // Completed steps that have rollback handlers
    const completedSteps = steps.filter(s => s.status === 'COMPLETED')
    if (completedSteps.length === 0) {
      return
    }

    // Reverse topological order: last-to-complete first
    const topoOrder = topologicalSort(definition.steps)
    const completedNames = new Set(completedSteps.map(s => s.stepName))
    const rollbackOrder = topoOrder
      .filter(name => completedNames.has(name))
      .reverse()

    for (const stepName of rollbackOrder) {
      const step = completedSteps.find(s => s.stepName === stepName)!
      const handlerKey = `${definition.name}.${stepName}`
      const handler = this.config.rollbackHandlers.get(handlerKey)
      if (!handler) {
        continue
      }

      await this.logStepEvent(
        step.id,
        tenantId,
        'rollback_started',
        {
          stepName,
        },
        runId,
      )

      try {
        const input = (fromJson(step.input) ?? {}) as Record<string, unknown>
        const output = (fromJson(step.output) ?? {}) as Record<string, unknown>
        await handler(input, output)

        await this.logStepEvent(
          step.id,
          tenantId,
          'rollback_completed',
          {
            stepName,
          },
          runId,
        )
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        await this.logStepEvent(
          step.id,
          tenantId,
          'rollback_failed',
          {
            stepName,
            error: errorMsg,
          },
          runId,
        )
        this.config.logger?.warn?.(
          `[WorkflowEngine] Rollback failed for step ${stepName} in run ${runId}:`,
          errorMsg,
        )
        // Notify the workflow's onRollbackFailed callback for alerting/escalation
        if (definition.onRollbackFailed) {
          try {
            await definition.onRollbackFailed({
              stepName,
              rollbackError:
                err instanceof Error ? err : new Error(String(err)),
              workflowRunId: runId,
              tenantId,
            })
          } catch {
            // onRollbackFailed itself must not break the rollback chain
          }
        }
      }
    }
  }

  // ── Budget Guardrails ─────────────────────────────────────────

  async incrementBudgetUsage(
    runId: string,
    field: keyof BudgetUsed,
    amount: number = 1,
  ): Promise<string | null> {
    const { rows } = await this.db.query<{
      budget: string | null
      budgetUsed: string | null
    }>(
      `UPDATE ${this.q('workflow_runs')}
       SET "budgetUsed" = (
         SELECT jsonb_set(
           COALESCE("budgetUsed"::jsonb, '{"tokens":0,"costUsd":0,"steps":0,"taskExecutions":0}'::jsonb),
           '{${field}}',
           to_jsonb(
             COALESCE(
               (COALESCE("budgetUsed"::jsonb, '{"tokens":0,"costUsd":0,"steps":0,"taskExecutions":0}'::jsonb) ->> '${field}')::numeric,
               0
             ) + $1
           )
         )::text
       ),
       "updatedAt" = NOW()
       WHERE id = $2
       RETURNING budget, "budgetUsed"`,
      [amount, runId],
    )

    const row = rows[0]
    if (!row) {
      return null
    }

    const budget = fromJson<WorkflowBudget>(row.budget)
    const used = fromJson<BudgetUsed>(row.budgetUsed) ?? {
      tokens: 0,
      costUsd: 0,
      steps: 0,
      taskExecutions: 0,
    }

    if (!budget) {
      return null
    }

    if (budget.maxTokens && used.tokens >= budget.maxTokens) {
      return `Token budget exceeded: ${used.tokens}/${budget.maxTokens}`
    }
    if (budget.maxCostUsd && used.costUsd >= budget.maxCostUsd) {
      return `Cost budget exceeded: $${used.costUsd}/$${budget.maxCostUsd}`
    }
    if (budget.maxSteps && used.steps >= budget.maxSteps) {
      return `Step budget exceeded: ${used.steps}/${budget.maxSteps}`
    }
    if (
      budget.maxTaskExecutions &&
      used.taskExecutions >= budget.maxTaskExecutions
    ) {
      return `Task execution budget exceeded: ${used.taskExecutions}/${budget.maxTaskExecutions}`
    }

    return null
  }

  async getBudgetUsage(
    runId: string,
  ): Promise<{ budget: WorkflowBudget | null; used: BudgetUsed }> {
    const { rows } = await this.db.query<{
      budget: string | null
      budgetUsed: string | null
    }>(
      `SELECT budget, "budgetUsed" FROM ${this.q('workflow_runs')} WHERE id = $1`,
      [runId],
    )
    const run = rows[0]
    return {
      budget: run ? fromJson<WorkflowBudget>(run.budget) : null,
      used: run
        ? (fromJson<BudgetUsed>(run.budgetUsed) ?? {
            tokens: 0,
            costUsd: 0,
            steps: 0,
            taskExecutions: 0,
          })
        : { tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 },
    }
  }

  private buildStepContext(
    run: WorkflowRun,
    steps: WorkflowStep[],
  ): StepContext {
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
    }
  }

  async buildStepContextWithTasks(
    run: WorkflowRun,
    steps: WorkflowStep[],
  ): Promise<StepContext> {
    const ctx = this.buildStepContext(run, steps)
    const tasks: Record<
      string,
      Array<{
        id: string
        payload: JsonObject | null
        result: JsonObject | null
        status: string
      }>
    > = {}

    for (const s of steps) {
      if (s.status === 'COMPLETED' && s.executorType === 'task_runner') {
        tasks[s.stepName] = await this.taskManager.getTaskResults(
          run.id,
          s.stepName,
        )
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
      if (s.output) {
        merged[s.stepName] = fromJson(s.output)
      }
    }
    return merged
  }

  // ══════════════════════════════════════════════════════════════════
  // DBOS-parity v2 features
  // ══════════════════════════════════════════════════════════════════

  // ── 1. Durable Sleep ──────────────────────────────────────────────

  async durableSleep(
    runId: string,
    stepName: string,
    tenantId: string,
    durationMs: number,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const deadlineEpochMs = Date.now() + durationMs

    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET status = $1, "deadlineEpochMs" = $2, "updatedAt" = $3 WHERE id = $4`,
      ['SLEEPING', String(deadlineEpochMs), new Date(), step.id],
    )

    const remaining = deadlineEpochMs - Date.now()
    if (remaining > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, remaining))
    }

    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET status = $1, "updatedAt" = $2 WHERE id = $3 AND status = $4`,
      ['RUNNING', new Date(), step.id, 'SLEEPING'],
    )
  }

  async resumeDurableSleep(
    runId: string,
    stepName: string,
    tenantId: string,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    if (step.status !== 'SLEEPING' || !step.deadlineEpochMs) {
      return
    }

    const remaining = Number(step.deadlineEpochMs) - Date.now()
    if (remaining > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, remaining))
    }

    await this.db.query(
      `UPDATE ${this.q('workflow_steps')} SET status = $1, "updatedAt" = $2 WHERE id = $3 AND status = $4`,
      ['RUNNING', new Date(), step.id, 'SLEEPING'],
    )
  }

  // ── 2. Timeout Enforcement ─────────────────────────────────────────

  async sweepTimedOutSteps(): Promise<number> {
    const { rows } = await this.db.query<{ id: string }>(
      `UPDATE ${this.q('workflow_steps')}
       SET status = 'FAILED',
           error = 'Heartbeat timeout exceeded',
           "completedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE id IN (
         SELECT id FROM ${this.q('workflow_steps')}
         WHERE status = 'RUNNING'
           AND "heartbeatTimeoutMs" IS NOT NULL
           AND "lastHeartbeatAt" IS NOT NULL
           AND (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "lastHeartbeatAt")) * 1000 > "heartbeatTimeoutMs"
       )
       RETURNING id`,
    )
    return rows.length
  }

  async sweepTimedOutWorkflows(): Promise<number> {
    const now = String(Date.now())
    const { rowCount } = await this.db.query(
      `UPDATE ${this.q('workflow_runs')}
       SET status = 'FAILED',
           error = 'Workflow timeout exceeded',
           "completedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE status = 'RUNNING'
         AND "deadlineEpochMs" IS NOT NULL
         AND "deadlineEpochMs"::BIGINT <= $1::BIGINT`,
      [now],
    )
    return rowCount ?? 0
  }

  // ── 3. Workflow Forking ───────────────────────────────────────────

  async forkWorkflow(
    runId: string,
    tenantId: string,
    fromStepName: string,
  ): Promise<{ runId: string }> {
    const run = await this.getRun(runId, tenantId)
    const steps = await this.findSteps(runId, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    const newRunId = nanoId(21)
    const now = new Date()

    await this.db.query(
      `INSERT INTO ${this.q('workflow_runs')} (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "traceId", "parentRunId", "originEventId", budget, "budgetUsed", "forkedFromRunId", "applicationVersion", "deadlineEpochMs", "timeoutMs", "delayUntilEpochMs", "startedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        newRunId,
        tenantId,
        run.workflowName,
        run.workflowVersion,
        'RUNNING',
        run.definitionSnapshot,
        run.triggerInput,
        null,
        nanoId(21),
        null,
        null,
        run.budget,
        toJson({ tokens: 0, costUsd: 0, steps: 0, taskExecutions: 0 }),
        runId,
        (run as any).applicationVersion ?? null,
        null,
        null,
        null,
        now,
        now,
        now,
      ],
    )

    const completedStepNames = new Set<string>()
    for (const step of steps) {
      if (step.status === 'COMPLETED') {
        completedStepNames.add(step.stepName)
      }
      if (step.stepName === fromStepName) {
        break
      }
    }

    for (const stepDef of definition.steps) {
      const originalStep = steps.find(s => s.stepName === stepDef.name)
      const isCompleted = completedStepNames.has(stepDef.name)

      await this.db.query(
        `INSERT INTO ${this.q('workflow_steps')} (id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, output, error, attempt, "maxRetries", "heartbeatTimeoutMs", "iterationCount", "maxIterations", "requiresLabels", "deadlineEpochMs", "startedAt", "completedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          nanoId(21),
          newRunId,
          tenantId,
          stepDef.name,
          isCompleted ? 'COMPLETED' : 'PENDING',
          stepDef.executorType,
          toJson(stepDef.executorConfig),
          toJson(stepDef.dependsOn ?? []),
          originalStep?.input ?? null,
          isCompleted ? (originalStep?.output ?? null) : null,
          null,
          0,
          stepDef.retries ?? definition.defaultRetries,
          stepDef.heartbeatTimeoutMs ?? null,
          0,
          stepDef.maxIterations ?? null,
          stepDef.requiresLabels?.length
            ? toJson(stepDef.requiresLabels)
            : null,
          null,
          isCompleted ? (originalStep?.startedAt ?? null) : null,
          isCompleted ? (originalStep?.completedAt ?? null) : null,
          now,
          now,
        ],
      )
    }

    return { runId: newRunId }
  }

  // ── 5. Workflow Streaming ─────────────────────────────────────────

  static readonly STREAM_CLOSED_SENTINEL = '__DELPHI_STREAM_CLOSED__'

  async writeStream(runId: string, key: string, value: string): Promise<void> {
    const { rows: maxRows } = await this.db.query<{ maxOffset: number }>(
      `SELECT COALESCE(MAX("offset"), -1) AS "maxOffset" FROM ${this.q('workflow_streams')} WHERE "workflowRunId" = $1 AND key = $2`,
      [runId, key],
    )
    const nextOffset = (maxRows[0]?.maxOffset ?? -1) + 1

    await this.db.query(
      `INSERT INTO ${this.q('workflow_streams')} (id, "workflowRunId", key, "offset", value) VALUES ($1,$2,$3,$4,$5)`,
      [nanoId(21), runId, key, nextOffset, value],
    )
  }

  async readStream(
    runId: string,
    key: string,
    fromOffset = 0,
  ): Promise<{ values: string[]; closed: boolean }> {
    const { rows } = await this.db.query<{ value: string; offset: number }>(
      `SELECT value, "offset" FROM ${this.q('workflow_streams')} WHERE "workflowRunId" = $1 AND key = $2 AND "offset" >= $3 ORDER BY "offset" ASC`,
      [runId, key, fromOffset],
    )

    const values: string[] = []
    let closed = false
    for (const row of rows) {
      if (row.value === WorkflowEngine.STREAM_CLOSED_SENTINEL) {
        closed = true
        break
      }
      values.push(row.value)
    }
    return { values, closed }
  }

  async closeStream(runId: string, key: string): Promise<void> {
    await this.writeStream(runId, key, WorkflowEngine.STREAM_CLOSED_SENTINEL)
  }

  // ── 6. Version-Aware Dispatch ─────────────────────────────────────

  async recoverPendingWorkflows(applicationVersion: string): Promise<string[]> {
    const { rows } = await this.db.query<{ id: string }>(
      `SELECT id FROM ${this.q('workflow_runs')} WHERE "applicationVersion" = $1 AND status IN ('RUNNING', 'PENDING')`,
      [applicationVersion],
    )
    return rows.map(r => r.id)
  }

  // ── 7. Delayed Workflow Execution ──────────────────────────────────

  /**
   * Transitions due delayed workflows to RUNNING and dispatches their root steps.
   * Called by the SchedulerService tick on each poll interval.
   */
  async processDelayedWorkflows(): Promise<number> {
    const now = String(Date.now())
    const { rows } = await this.db.query<{
      id: string
      tenantId: string
      definitionSnapshot: string
    }>(
      `UPDATE ${this.q('workflow_runs')}
       SET status = 'RUNNING',
           "startedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE status = 'DELAYED'
         AND "delayUntilEpochMs" IS NOT NULL
         AND "delayUntilEpochMs"::BIGINT <= $1::BIGINT
       RETURNING id, "tenantId", "definitionSnapshot"`,
      [now],
    )
    if (!rows.length) return 0

    for (const run of rows) {
      const definition = fromJson(
        run.definitionSnapshot,
      ) as WorkflowDefinition
      const rootNames = new Set(
        definition.steps
          .filter(s => !s.dependsOn?.length)
          .map(s => s.name),
      )
      const { rows: steps } = await this.db.query<WorkflowStep>(
        `SELECT * FROM ${this.q('workflow_steps')}
         WHERE "workflowRunId" = $1 AND status = 'QUEUED'`,
        [run.id],
      )
      const rootSteps = steps.filter(s => rootNames.has(s.stepName))
      await this.dispatchStepsBulk(
        rootSteps.map(step => ({
          runId: run.id,
          tenantId: run.tenantId,
          step,
          definition,
        })),
      )
    }
    return rows.length
  }

  // ── 9. Queue Partitioning ─────────────────────────────────────

  async createPartitionedTasks(
    runId: string,
    stepName: string,
    tasks: Array<{ payload: Record<string, unknown>; partitionKey?: string }>,
  ): Promise<string[]> {
    if (tasks.length === 0) {
      return []
    }
    const ids: string[] = []
    for (const t of tasks) {
      const id = nanoId(21)
      ids.push(id)
      await this.db.query(
        `INSERT INTO ${this.q('workflow_tasks')} (id, "workflowRunId", "stepName", status, payload, result, error, attempt, "maxRetries", priority, "queuePartitionKey")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id,
          runId,
          stepName,
          'pending',
          toJson(t.payload),
          null,
          null,
          0,
          3,
          null,
          t.partitionKey ?? null,
        ],
      )
    }
    return ids
  }

  async fetchNextPartitionedTask(
    runId: string,
    stepName: string,
    partitionKey?: string,
  ): Promise<import('../entities/Database.js').WorkflowTask | null> {
    if (partitionKey) {
      const { rows } = await this.db.query<
        import('../entities/Database.js').WorkflowTask
      >(
        `SELECT * FROM ${this.q('workflow_tasks')}
         WHERE "workflowRunId" = $1
           AND "stepName" = $2
           AND status = 'pending'
           AND "queuePartitionKey" = $3
         ORDER BY priority DESC NULLS LAST, "createdAt" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [runId, stepName, partitionKey],
      )
      return rows[0] ?? null
    }
    return this.taskManager.fetchNextTask(runId, stepName)
  }

  // ── 10. Dual-Mode GC ─────────────────────────────────────────────

  async gc(opts: {
    retentionDays?: number
    maxRows?: number
  }): Promise<number> {
    let cutoffDate: Date | null = null

    if (opts.retentionDays != null) {
      cutoffDate = new Date(Date.now() - opts.retentionDays * 86_400_000)
    }

    if (opts.maxRows != null) {
      const { rows } = await this.db.query<{ createdAt: string }>(
        `SELECT "createdAt" FROM ${this.q('workflow_runs')} ORDER BY "createdAt" DESC OFFSET $1 LIMIT 1`,
        [opts.maxRows],
      )
      if (rows[0]) {
        const maxRowsCutoff = new Date(rows[0].createdAt as string)
        if (!cutoffDate || maxRowsCutoff > cutoffDate) {
          cutoffDate = maxRowsCutoff
        }
      }
    }

    if (!cutoffDate) {
      return 0
    }

    const { rowCount } = await this.db.query(
      `DELETE FROM ${this.q('workflow_runs')} WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED') AND "createdAt" <= $1`,
      [cutoffDate],
    )

    return rowCount ?? 0
  }
}

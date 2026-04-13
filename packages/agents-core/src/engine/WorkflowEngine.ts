// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import { Ids } from '@goatlab/js-utils'

/** Escape a value for COPY FROM tab-delimited format */
function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '\\N'
  return v.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}
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
import type { WorkflowEngineConfig } from './WorkflowEngine.types.js'

export class WorkflowEngine {
  private config: WorkflowEngineConfig
  private db: Kysely<Database>

  /**
   * The consistency layer for ALL external side effects.
   * Use `engine.externalAction()` to execute any call that modifies
   * external systems (GitHub, Linear, Slack, etc.)
   */
  readonly externalActions: ExternalActionExecutor

  // Buffered log writer (Hatchet pattern)
  private logBuffer: Array<{
    id: string
    stepId: string
    tenantId: string
    event: string
    data?: Record<string, unknown>
  }> = []
  private logFlushTimer?: ReturnType<typeof setTimeout>
  private readonly LOG_FLUSH_INTERVAL = 50
  private readonly LOG_FLUSH_THRESHOLD = 50

  // Note: Start buffering is handled via startBatch() for batch API.
  // Single starts use raw SQL single-round-trip optimization.

  constructor(config: WorkflowEngineConfig) {
    this.config = config
    this.db = config.db

    this.externalActions = new ExternalActionExecutor({
      db: config.db,
      rateLimits: config.rateLimits,
      maxConcurrentPerWorkflow: config.maxConcurrentPerWorkflow,
      rateLimiterBackend: config.rateLimiterBackend,
      logger: config.logger,
    })

    if (!config.disableLogBuffering) {
      this.startLogFlushTimer()
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
    if (this.logFlushTimer) clearInterval(this.logFlushTimer)
    await this.flushLogs()
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

      const runId = Ids.nanoId(21)
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

    // Dispatch root steps for all workflows
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        await this.dispatchStep(runId, trigger.tenantId, stepRow as any, definition)
      }
    }

    return results.map(r => ({ runId: r.runId }))
  }

  /**
   * Bulk start workflows using COPY FROM (Hatchet's fastest path).
   * Requires pgPool in engine config. Falls back to startBatch() if not available.
   *
   * COPY FROM bypasses the INSERT planner and uses optimized buffer/lock handling.
   * Hatchet reports 63-92k writes/sec with this approach.
   */
  async startBatchCopy(triggers: WorkflowTriggerInput[]): Promise<Array<{ runId: string }>> {
    if (!this.config.pgPool || triggers.length === 0) {
      return this.startBatch(triggers)
    }

    const results: Array<{ runId: string; stepRows: any[]; definition: WorkflowDefinition; trigger: WorkflowTriggerInput }> = []
    const runLines: string[] = []
    const stepLines: string[] = []

    for (const trigger of triggers) {
      const definition = this.config.workflows.get(trigger.workflowName)
      if (!definition) throw new WorkflowNotFoundError(trigger.workflowName)

      const runId = Ids.nanoId(21)
      const now = new Date().toISOString()
      const rootNames = new Set(definition.steps.filter(s => !s.dependsOn?.length).map(s => s.name))

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

      const triggerInput = toJson(trigger.input)
      const idempKey = trigger.idempotencyKey ?? '\\N'

      // Tab-delimited COPY line for workflow_runs
      // Columns: id, tenantId, workflowName, workflowVersion, status, definitionSnapshot,
      //   triggerInput, idempotencyKey, startedAt, completedAt, createdAt, updatedAt
      runLines.push([
        runId, trigger.tenantId, trigger.workflowName, definition.version,
        'RUNNING', esc(snapshot), esc(triggerInput), idempKey, now, '\\N', now, now,
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
        stepLines.push([
          stepId, runId, trigger.tenantId, stepDef.name,
          isRoot ? 'QUEUED' : 'PENDING', stepDef.executorType,
          esc(toJson(stepDef.executorConfig)), esc(toJson(stepDef.dependsOn ?? [])),
          isRoot ? esc(toJson(input)) : '\\N',  // input
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

      results.push({ runId, stepRows: localStepRows, definition, trigger })
    }

    // Execute COPY FROM for both tables
    const client = await this.config.pgPool.connect()
    try {
      await client.query('BEGIN')

      // COPY workflow_runs
      const { from: copyFrom } = await import('pg-copy-streams')
      const runStream = client.query(copyFrom(
        'COPY workflow_runs (id, "tenantId", "workflowName", "workflowVersion", status, "definitionSnapshot", "triggerInput", "idempotencyKey", "startedAt", "completedAt", "createdAt", "updatedAt") FROM STDIN',
      ))
      runStream.write(runLines.join('\n') + '\n')
      runStream.end()
      await new Promise((resolve, reject) => { runStream.on('finish', resolve); runStream.on('error', reject) })

      // COPY workflow_steps
      const stepStream = client.query(copyFrom(
        'COPY workflow_steps (id, "workflowRunId", "tenantId", "stepName", status, "executorType", "executorConfig", "dependsOn", input, output, error, attempt, "maxRetries", "startedAt", "completedAt", "scheduledAt", "lastHeartbeatAt", "lastHeartbeatData", "heartbeatTimeoutMs", "humanPrompt", "humanResponse", "humanRespondedBy", "humanRespondedAt", "iterationCount", "maxIterations", "tokensUsed", "costUsd", "modelUsed", "createdAt", "updatedAt") FROM STDIN',
      ))
      stepStream.write(stepLines.join('\n') + '\n')
      stepStream.end()
      await new Promise((resolve, reject) => { stepStream.on('finish', resolve); stepStream.on('error', reject) })

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Dispatch root steps for all workflows
    for (const { runId, stepRows, definition, trigger } of results) {
      const rootSteps = definition.steps.filter(s => !s.dependsOn?.length)
      for (const stepDef of rootSteps) {
        const stepRow = stepRows.find(r => r.stepName === stepDef.name)!
        await this.dispatchStep(runId, trigger.tenantId, stepRow as any, definition)
      }
    }

    return results.map(r => ({ runId: r.runId }))
  }

  // ── Step Running ───────────────────────────────────────────────

  async markStepRunning(runId: string, stepName: string, tenantId: string): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    await this.updateStepStatus(step.id, step.status, 'RUNNING')
    await this.logStepEvent(step.id, tenantId, 'started')
  }

  // ── Step Completion ────────────────────────────────────────────

  async onStepCompleted(
    runId: string, stepName: string, tenantId: string, result: StepResult,
  ): Promise<void> {
    const step = await this.getStep(runId, stepName, tenantId)
    const definition = await this.getDefinitionForRun(runId)

    if (result.waitForHuman) {
      await this.updateStepStatus(step.id, step.status, 'WAITING_HUMAN')
      await this.db.updateTable('workflow_steps').set({
        output: toJson(result.output),
        humanPrompt: toJson(result.waitForHuman),
        updatedAt: new Date(),
      }).where('id', '=', step.id).execute()
      await this.logStepEvent(step.id, tenantId, 'human_requested', {
        prompt: result.waitForHuman.prompt,
      })
    } else {
      await this.updateStepStatus(step.id, step.status, 'COMPLETED')
      await this.db.updateTable('workflow_steps').set({
        output: toJson(result.output),
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where('id', '=', step.id).execute()
      await this.logStepEvent(step.id, tenantId, 'completed', {
        outputKeys: Object.keys(result.output),
      })
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
      await this.updateStepStatus(step.id, step.status, 'FAILED')
      await this.db.updateTable('workflow_steps').set({
        error: error.message,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where('id', '=', step.id).execute()
      await this.logStepEvent(step.id, tenantId, 'failed', {
        attempt: step.attempt, error: error.message, nonRetryable: isNonRetryable,
      })
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
        await this.db.updateTable('workflow_runs').set({
          completedAt: new Date(),
          output: toJson(this.mergeStepOutputs(steps)),
          updatedAt: new Date(),
        }).where('id', '=', runId).execute()
        if (definition.onComplete) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onComplete(ctx)
        }
      } else if (newStatus === 'FAILED') {
        const failedStep = steps.find(s => s.status === 'FAILED')
        await this.db.updateTable('workflow_runs').set({
          completedAt: new Date(),
          error: failedStep?.error ?? 'Unknown error',
          updatedAt: new Date(),
        }).where('id', '=', runId).execute()
        if (definition.onFail) {
          const ctx = this.buildStepContext(run, steps)
          await definition.onFail(ctx, new Error(failedStep?.error ?? 'Unknown error'))
        }
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

  private async dispatchStep(runId: string, tenantId: string, step: WorkflowStep, definition: WorkflowDefinition): Promise<void> {
    const stepDef = definition.steps.find(s => s.name === step.stepName)!

    const payload: StepPayload = {
      workflowRunId: runId,
      stepName: step.stepName,
      tenantId,
      input: (fromJson(step.input) ?? {}) as JsonObject,
      attempt: step.attempt,
      executorType: step.executorType,
      executorConfig: (fromJson(step.executorConfig) ?? {}) as Record<string, unknown>,
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

    if (this.config.disableLogBuffering) {
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

    this.logBuffer.push(entry)
    if (this.logBuffer.length >= this.LOG_FLUSH_THRESHOLD) {
      await this.flushLogs()
    }
  }

  private startLogFlushTimer(): void {
    this.logFlushTimer = setInterval(() => {
      if (this.logBuffer.length > 0) this.flushLogs().catch(() => {})
    }, this.LOG_FLUSH_INTERVAL)
    if (this.logFlushTimer.unref) this.logFlushTimer.unref()
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return
    const batch = this.logBuffer
    this.logBuffer = []

    try {
      const now = new Date().toISOString()

      // COPY FROM path (fast) — if pgPool is available
      if (this.config.pgPool) {
        const lines = batch.map(e =>
          [e.id, e.stepId, e.tenantId, e.event, esc(toJson(e.data ?? null)), now].join('\t'),
        ).join('\n') + '\n'

        const client = await this.config.pgPool.connect()
        try {
          const { from: copyFrom } = await import('pg-copy-streams')
          const stream = client.query(copyFrom(
            'COPY workflow_step_logs (id, "stepId", "tenantId", event, data, "createdAt") FROM STDIN',
          ))
          stream.write(lines)
          stream.end()
          await new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })
        } finally {
          client.release()
        }
        return
      }

      // INSERT fallback (when pgPool not configured)
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
    } catch (err) {
      this.logBuffer.unshift(...batch)
      this.config.logger?.error?.('Failed to flush log batch:', err)
    }
  }

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
    }
  }

  private mergeStepOutputs(steps: WorkflowStep[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    for (const s of steps) {
      if (s.output) merged[s.stepName] = fromJson(s.output)
    }
    return merged
  }
}

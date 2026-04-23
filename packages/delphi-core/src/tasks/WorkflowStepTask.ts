// npx vitest run src/__tests__/engine/lifecycle.spec.ts

import { hostname } from 'node:os'
import type { JsonObject } from '@goatlab/tasks-core'
import { ShouldQueue } from '@goatlab/tasks-core'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type {
  StepExecutionContext,
  StepPayload,
} from '../workflow/WorkflowBuilder.types.js'

export class WorkflowStepTask extends ShouldQueue<
  StepPayload,
  JsonObject,
  'workflow_step'
> {
  readonly taskName = 'workflow_step' as const
  readonly postUrl = '/workflow/step'

  private engine: WorkflowEngine

  constructor(engine: WorkflowEngine) {
    super()
    this.engine = engine
  }

  async handle(payload: StepPayload): Promise<JsonObject> {
    if (payload.transactional) {
      return this.handleTransactional(payload)
    }
    return this.handleDefault(payload)
  }

  /**
   * Default (non-transactional) execution path — unchanged from original.
   * Step execution and result recording happen in separate DB operations.
   */
  private async handleDefault(payload: StepPayload): Promise<JsonObject> {
    const executor = this.engine.getExecutor(payload.executorType)
    if (!executor) {
      throw new Error(
        `No executor registered for type "${payload.executorType}"`,
      )
    }

    // Mark step as RUNNING (transition from QUEUED)
    await this.engine.markStepRunning(
      payload.workflowRunId,
      payload.stepName,
      payload.tenantId,
      `${hostname()}:${process.pid}`,
    )

    try {
      // Run interceptors beforeExecute
      let processedPayload = payload
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.beforeExecute) {
          processedPayload = await interceptor.beforeExecute(processedPayload)
        }
      }

      // Build execution context with engine services
      const executionContext: StepExecutionContext = {
        externalActions: this.engine.externalActions,
        integrations: this.engine.config.integrations,
        taskManager: this.engine.taskManager,
        checkBudget: (runId, field, amount) =>
          this.engine.incrementBudgetUsage(runId, field as any, amount),
      }

      // Execute the step
      let result = await executor.execute(processedPayload, executionContext)

      // Run interceptors afterExecute
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.afterExecute) {
          result = await interceptor.afterExecute(processedPayload, result)
        }
      }

      // Notify engine of completion
      await this.engine.onStepCompleted(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        result,
      )

      return result.output
    } catch (error) {
      // Run interceptors onError
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.onError) {
          await interceptor.onError(payload, error as Error)
        }
      }

      // Notify engine of failure
      await this.engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )

      throw error
    }
  }

  /**
   * Transactional execution path — step handler + result recording happen
   * in a single PG transaction. The handler receives `ctx.tx` (a PoolClient)
   * so app writes are in the same transaction. COMMIT = atomic.
   *
   * On error the transaction is rolled back — neither app writes nor step
   * completion are persisted. The step then follows the normal failure path
   * (retry / mark FAILED) outside the transaction.
   */
  private async handleTransactional(payload: StepPayload): Promise<JsonObject> {
    const executor = this.engine.getExecutor(payload.executorType)
    if (!executor) {
      throw new Error(
        `No executor registered for type "${payload.executorType}"`,
      )
    }

    const pool = this.engine.db.getPool()
    const client = await pool.connect()
    const workerIdentity = `${hostname()}:${process.pid}`

    try {
      await client.query('BEGIN')

      // Mark step as RUNNING inside the transaction
      await client.query(
        `UPDATE ${this.engine.qualifiedTable('workflow_steps')} SET status = $1, "startedAt" = $2, "updatedAt" = $3, "executedBy" = $4 WHERE "workflowRunId" = $5 AND "stepName" = $6 AND "tenantId" = $7 AND status = 'QUEUED'`,
        [
          'RUNNING',
          new Date(),
          new Date(),
          workerIdentity,
          payload.workflowRunId,
          payload.stepName,
          payload.tenantId,
        ],
      )

      // Run interceptors beforeExecute
      let processedPayload = payload
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.beforeExecute) {
          processedPayload = await interceptor.beforeExecute(processedPayload)
        }
      }

      // Build execution context WITH the transactional client
      const executionContext: StepExecutionContext = {
        externalActions: this.engine.externalActions,
        integrations: this.engine.config.integrations,
        taskManager: this.engine.taskManager,
        checkBudget: (runId, field, amount) =>
          this.engine.incrementBudgetUsage(runId, field as any, amount),
        tx: client,
      }

      // Execute the step — handler's app writes go through ctx.tx
      let result = await executor.execute(processedPayload, executionContext)

      // Run interceptors afterExecute
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.afterExecute) {
          result = await interceptor.afterExecute(processedPayload, result)
        }
      }

      // Record step completion IN THE SAME TRANSACTION
      const now = new Date()
      const outputJson = JSON.stringify(result.output)

      if (result.waitForHuman) {
        const humanJson = JSON.stringify(result.waitForHuman)
        await client.query(
          `UPDATE ${this.engine.qualifiedTable('workflow_steps')} SET status = $1, output = $2, "humanPrompt" = $3, "updatedAt" = $4 WHERE "workflowRunId" = $5 AND "stepName" = $6 AND "tenantId" = $7`,
          [
            'WAITING_HUMAN',
            outputJson,
            humanJson,
            now,
            payload.workflowRunId,
            payload.stepName,
            payload.tenantId,
          ],
        )
      } else {
        await client.query(
          `UPDATE ${this.engine.qualifiedTable('workflow_steps')} SET status = $1, output = $2, "completedAt" = $3, "updatedAt" = $4 WHERE "workflowRunId" = $5 AND "stepName" = $6 AND "tenantId" = $7`,
          [
            'COMPLETED',
            outputJson,
            now,
            now,
            payload.workflowRunId,
            payload.stepName,
            payload.tenantId,
          ],
        )
      }

      // Log step event inside the transaction
      const eventType = result.waitForHuman ? 'human_requested' : 'completed'
      const eventData = result.waitForHuman
        ? { prompt: result.waitForHuman.prompt }
        : { outputKeys: Object.keys(result.output) }
      const stepRow = await client.query<{ id: string }>(
        `SELECT id FROM ${this.engine.qualifiedTable('workflow_steps')} WHERE "workflowRunId" = $1 AND "stepName" = $2 AND "tenantId" = $3`,
        [payload.workflowRunId, payload.stepName, payload.tenantId],
      )
      if (stepRow.rows[0]) {
        await client.query(
          `INSERT INTO ${this.engine.qualifiedTable('workflow_step_logs')} (id, "stepId", "workflowRunId", "tenantId", event, data, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
          [
            stepRow.rows[0].id,
            payload.workflowRunId,
            payload.tenantId,
            eventType,
            JSON.stringify(eventData),
            now,
          ],
        )
      }

      await client.query('COMMIT')

      // ── Post-commit work (outside transaction) ──
      // These are fire-and-forget side effects that must NOT be inside the tx.

      // Emit engine events
      if (this.engine.config.onEngineEvent) {
        const traceId = await this.engine.resolveTraceIdPublic(
          payload.workflowRunId,
          payload.tenantId,
        )
        if (result.waitForHuman) {
          this.engine.config.onEngineEvent({
            type: 'step.human_requested',
            tenantId: payload.tenantId,
            runId: payload.workflowRunId,
            traceId: traceId ?? payload.workflowRunId,
            stepName: payload.stepName,
            prompt: result.waitForHuman.prompt,
            schema: result.waitForHuman.schema,
          } as any)
        } else {
          this.engine.config.onEngineEvent({
            type: 'step.completed',
            tenantId: payload.tenantId,
            runId: payload.workflowRunId,
            traceId: traceId ?? payload.workflowRunId,
            stepName: payload.stepName,
            output: result.output,
          } as any)
        }
      }

      // Budget enforcement + advance workflow (non-transactional, post-commit)
      if (!result.waitForHuman) {
        await this.engine.postStepCompleted(
          payload.workflowRunId,
          payload.stepName,
          payload.tenantId,
          result,
        )
      }

      return result.output
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})

      // Run interceptors onError
      for (const interceptor of this.engine.config.interceptors ?? []) {
        if (interceptor.onError) {
          await interceptor.onError(payload, error as Error)
        }
      }

      // Notify engine of failure (outside the rolled-back tx)
      await this.engine.onStepFailed(
        payload.workflowRunId,
        payload.stepName,
        payload.tenantId,
        error as Error,
      )

      throw error
    } finally {
      client.release()
    }
  }
}

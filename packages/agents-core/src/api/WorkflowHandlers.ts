// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { HumanInput, WorkflowTriggerInput } from '../workflow/WorkflowBuilder.types.js'

/**
 * Pre-built handler functions for workflow management API endpoints.
 *
 * These are framework-agnostic — plug them into tRPC, Express, Fastify, etc.
 *
 * Usage with tRPC:
 * ```typescript
 * const handlers = createWorkflowHandlers(engine)
 * const router = t.router({
 *   startWorkflow: t.procedure.input(z.object({...})).mutation(({ input }) => handlers.start(input)),
 *   getStatus: t.procedure.input(z.object({...})).query(({ input }) => handlers.getStatus(input)),
 * })
 * ```
 */
export function createWorkflowHandlers(engine: WorkflowEngine) {
  return {
    /**
     * List workflow runs with optional filters.
     */
    async listWorkflows(input: {
      tenantId: string
      status?: string[]
      workflowName?: string
      limit?: number
      offset?: number
    }) {
      return engine.listWorkflows(input.tenantId, {
        status: input.status,
        workflowName: input.workflowName,
        limit: input.limit ?? 50,
        offset: input.offset,
      })
    },

    /**
     * Start a new workflow run.
     */
    async start(input: {
      workflowName: string
      tenantId: string
      input: Record<string, unknown>
      idempotencyKey?: string
      priority?: number
    }): Promise<{ runId: string }> {
      return engine.start({
        workflowName: input.workflowName,
        tenantId: input.tenantId,
        input: input.input as any,
        idempotencyKey: input.idempotencyKey,
        priority: input.priority,
      })
    },

    /**
     * Get workflow run status with all steps.
     */
    async getStatus(input: {
      runId: string
      tenantId: string
    }) {
      const run = await engine.getStatus(input.runId, input.tenantId)
      return {
        id: run.id,
        workflowName: run.workflowName,
        workflowVersion: run.workflowVersion,
        status: run.status,
        triggerInput: run.triggerInput,
        output: run.output,
        error: run.error,
        startedAt: run.startedAt ? String(run.startedAt) : null,
        completedAt: run.completedAt ? String(run.completedAt) : null,
        createdAt: String(run.createdAt),
        steps: run.steps.map(s => ({
          id: s.id,
          stepName: s.stepName,
          status: s.status,
          executorType: s.executorType,
          attempt: s.attempt,
          maxRetries: s.maxRetries,
          dependsOn: (s as any).dependsOn ?? [],
          input: s.input,
          output: s.output,
          error: s.error,
          startedAt: s.startedAt ? String(s.startedAt) : null,
          completedAt: s.completedAt ? String(s.completedAt) : null,
          humanPrompt: s.humanPrompt,
          humanResponse: s.humanResponse,
          humanRespondedBy: s.humanRespondedBy,
        })),
      }
    },

    /**
     * Submit human input for a waiting step.
     */
    async submitHumanInput(input: {
      workflowRunId: string
      stepName: string
      tenantId: string
      data: Record<string, unknown>
      respondedBy?: string
    }): Promise<{ success: true }> {
      await engine.submitHumanInput({
        workflowRunId: input.workflowRunId,
        stepName: input.stepName,
        tenantId: input.tenantId,
        data: input.data as any,
        respondedBy: input.respondedBy,
      })
      return { success: true }
    },

    /**
     * Send a signal to a running workflow.
     */
    async signal(input: {
      runId: string
      tenantId: string
      signalName: string
      data: Record<string, unknown>
    }): Promise<{ success: true }> {
      await engine.signal(
        input.runId,
        input.tenantId,
        input.signalName,
        input.data,
      )
      return { success: true }
    },

    /**
     * Execute a read-only query on a workflow.
     */
    async query(input: {
      runId: string
      tenantId: string
      queryName: string
    }): Promise<Record<string, unknown>> {
      return engine.query(input.runId, input.tenantId, input.queryName)
    },

    /**
     * Cancel a running workflow.
     */
    async cancel(input: {
      runId: string
      tenantId: string
    }): Promise<{ success: true }> {
      await engine.cancel(input.runId, input.tenantId)
      return { success: true }
    },

    /**
     * Record a heartbeat from a running step.
     */
    async heartbeat(input: {
      runId: string
      stepName: string
      tenantId: string
      data?: Record<string, unknown>
    }): Promise<{ success: true }> {
      await engine.heartbeat(
        input.runId,
        input.stepName,
        input.tenantId,
        input.data,
      )
      return { success: true }
    },
  }
}

export type WorkflowHandlers = ReturnType<typeof createWorkflowHandlers>

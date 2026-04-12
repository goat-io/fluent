// npx vitest run src/__tests__/engine/lifecycle.spec.ts
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import { WorkflowMetricsCollector } from '../engine/WorkflowMetrics.js'
import { randomUUID } from 'node:crypto'
import { EventIngestionService } from '../events/EventIngestion.js'
import { WebhookVerifier } from '../events/WebhookVerifier.js'
import { toJson, fromJson } from '../entities/Database.js'
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
  const metricsCollector = new WorkflowMetricsCollector(engine['db'])
  const eventService = new EventIngestionService({ db: engine['db'] })

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
     * Batch start multiple workflows (Hatchet pattern: single DB round-trip).
     */
    async startBatch(input: {
      workflows: Array<{ workflowName: string; tenantId: string; input: Record<string, unknown>; idempotencyKey?: string }>
    }): Promise<Array<{ runId: string }>> {
      return engine.startBatch(input.workflows.map(w => ({
        workflowName: w.workflowName,
        tenantId: w.tenantId,
        input: w.input as any,
        idempotencyKey: w.idempotencyKey,
      })))
    },

    /**
     * Batch start using COPY FROM (fastest path).
     */
    async startBatchCopy(input: {
      workflows: Array<{ workflowName: string; tenantId: string; input: Record<string, unknown>; idempotencyKey?: string }>
    }): Promise<Array<{ runId: string }>> {
      return engine.startBatchCopy(input.workflows.map(w => ({
        workflowName: w.workflowName,
        tenantId: w.tenantId,
        input: w.input as any,
        idempotencyKey: w.idempotencyKey,
      })))
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

    // ── Event Ingestion ──────────────────────────────────────────

    /**
     * Ingest an external event. Optionally verify webhook signature.
     */
    async ingestEvent(input: {
      tenantId: string
      eventType: string
      source: string
      payload: Record<string, unknown>
      idempotencyKey?: string
      signature?: string
      webhookSecret?: string
    }) {
      if (input.signature && input.webhookSecret) {
        const payloadStr = JSON.stringify(input.payload)
        const valid = WebhookVerifier.verifyHmacSha256(payloadStr, input.signature, input.webhookSecret)
        if (!valid) throw new Error('Invalid webhook signature')
      }
      return eventService.ingest({
        tenantId: input.tenantId,
        eventType: input.eventType,
        source: input.source,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      })
    },

    /**
     * List dead letter events for a tenant.
     */
    async listDeadLetterEvents(input: {
      tenantId: string
      eventType?: string
      limit?: number
    }) {
      return eventService.listDeadLetters(input.tenantId, {
        eventType: input.eventType,
        limit: input.limit,
      })
    },

    /**
     * Replay a dead letter event.
     */
    async replayDeadLetterEvent(input: { eventId: string }) {
      return eventService.replayDeadLetter(input.eventId)
    },

    /**
     * Get detailed metrics for a single workflow run (latency, cost, external actions).
     */
    async getRunMetrics(input: {
      runId: string
    }) {
      return metricsCollector.getRunMetrics(input.runId)
    },

    /**
     * Get aggregate metrics across workflow runs (avg latency, p50/p95/p99, cost by provider).
     */
    async getAggregateMetrics(input: {
      tenantId: string
      since?: string
      workflowName?: string
    }) {
      return metricsCollector.getAggregateMetrics(input.tenantId, {
        since: input.since ? new Date(input.since) : undefined,
        workflowName: input.workflowName,
      })
    },

    // ── Worker Management ──────────────────────────────────────────

    async registerWorker(input: {
      tenantId: string
      name: string
      hostname?: string
      capabilities?: Record<string, unknown>
    }): Promise<{ workerId: string }> {
      const id = randomUUID()
      await (engine as any).db.insertInto('worker_nodes').values({
        id,
        tenantId: input.tenantId,
        name: input.name,
        hostname: input.hostname ?? null,
        capabilities: toJson(input.capabilities ?? null),
        status: 'active',
        lastHeartbeatAt: new Date(),
        registeredAt: new Date(),
      }).execute()
      return { workerId: id }
    },

    async workerHeartbeat(input: { workerId: string }): Promise<{ success: true }> {
      await (engine as any).db.updateTable('worker_nodes')
        .set({ lastHeartbeatAt: new Date() })
        .where('id', '=', input.workerId).execute()
      return { success: true }
    },

    async listWorkers(input: { tenantId: string }) {
      const rows = await (engine as any).db.selectFrom('worker_nodes').selectAll()
        .where('tenantId', '=', input.tenantId)
        .where('status', '!=', 'offline').execute()
      return rows.map((r: any) => ({
        id: r.id, name: r.name, hostname: r.hostname,
        capabilities: fromJson(r.capabilities),
        status: r.status, lastHeartbeatAt: r.lastHeartbeatAt ? String(r.lastHeartbeatAt) : null,
        registeredAt: String(r.registeredAt),
      }))
    },

    async deregisterWorker(input: { workerId: string }): Promise<{ success: true }> {
      await (engine as any).db.updateTable('worker_nodes')
        .set({ status: 'offline' })
        .where('id', '=', input.workerId).execute()
      return { success: true }
    },

    // ── Validation ─────────────────────────────────────────────────

    async validateDefinition(input: { definition: Record<string, unknown> }): Promise<{ valid: boolean; errors: string[] }> {
      const errors: string[] = []
      const def = input.definition
      if (!def.name || typeof def.name !== 'string' || (def.name as string).trim() === '') errors.push('Workflow name is required')
      if (!def.version || typeof def.version !== 'string') errors.push('Workflow version is required')
      if (!Array.isArray(def.steps) || def.steps.length === 0) {
        errors.push('Workflow must have at least one step')
        return { valid: false, errors }
      }
      const steps = def.steps as Array<Record<string, unknown>>
      const names = new Set<string>()
      for (const step of steps) {
        if (!step.name || typeof step.name !== 'string') { errors.push('Each step must have a name'); continue }
        if (names.has(step.name as string)) errors.push(`Duplicate step name: "${step.name}"`)
        names.add(step.name as string)
        const deps = (step.dependsOn ?? []) as string[]
        for (const dep of deps) {
          if (!steps.some(s => s.name === dep)) errors.push(`Step "${step.name}" depends on unknown step "${dep}"`)
          if (dep === step.name) errors.push(`Step "${step.name}" depends on itself`)
        }
      }
      return { valid: errors.length === 0, errors }
    },
  }
}

export type WorkflowHandlers = ReturnType<typeof createWorkflowHandlers>

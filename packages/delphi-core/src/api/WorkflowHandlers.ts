// npx vitest run src/__tests__/engine/lifecycle.spec.ts

import { randomUUID } from 'node:crypto'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import { WorkflowMetricsCollector } from '../engine/WorkflowMetrics.js'
import { fromJson, toJson } from '../entities/Database.js'
import { EventIngestionService } from '../events/EventIngestion.js'
import { WebhookVerifier } from '../events/WebhookVerifier.js'

export function createWorkflowHandlers(engine: WorkflowEngine) {
  const metricsCollector = new WorkflowMetricsCollector(engine.db)
  const eventService = new EventIngestionService({ db: engine.db })

  return {
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

    async startBatch(input: {
      workflows: Array<{
        workflowName: string
        tenantId: string
        input: Record<string, unknown>
        idempotencyKey?: string
      }>
    }): Promise<Array<{ runId: string }>> {
      return engine.startBatch(
        input.workflows.map(w => ({
          workflowName: w.workflowName,
          tenantId: w.tenantId,
          input: w.input as any,
          idempotencyKey: w.idempotencyKey,
        })),
      )
    },

    async startBatchCopy(input: {
      workflows: Array<{
        workflowName: string
        tenantId: string
        input: Record<string, unknown>
        idempotencyKey?: string
      }>
    }): Promise<Array<{ runId: string }>> {
      return engine.startBatchCopy(
        input.workflows.map(w => ({
          workflowName: w.workflowName,
          tenantId: w.tenantId,
          input: w.input as any,
          idempotencyKey: w.idempotencyKey,
        })),
      )
    },

    async listDefinitions() {
      const defs: Array<{ name: string; version: string; stepCount: number }> =
        []
      for (const [, def] of engine.getWorkflows()) {
        defs.push({
          name: def.name,
          version: def.version,
          stepCount: def.steps.length,
        })
      }
      return defs
    },

    async getDefinition(input: { workflowName: string }) {
      const def = engine.getWorkflows().get(input.workflowName)
      if (!def) {
        throw new Error(`Workflow "${input.workflowName}" not found`)
      }

      const inputFields: Array<{ name: string; source: string }> = []
      const seen = new Set<string>()
      for (const step of def.steps) {
        const config = step.executorConfig as Record<string, unknown>
        for (const [key, value] of Object.entries(config)) {
          if (typeof value === 'string') {
            const matches = value.matchAll(/\{\{input\.(\w+)\}\}/g)
            for (const match of matches) {
              if (!seen.has(match[1])) {
                seen.add(match[1])
                inputFields.push({
                  name: match[1],
                  source: `${step.name}.${key}`,
                })
              }
            }
          }
        }
      }

      const finalInputFields =
        inputFields.length > 0
          ? inputFields
          : (def.inputFields ?? []).map(name => ({ name, source: 'declared' }))

      return {
        name: def.name,
        version: def.version,
        steps: def.steps.map(s => ({
          name: s.name,
          executorType: s.executorType,
          dependsOn: s.dependsOn,
        })),
        inputFields: finalInputFields,
      }
    },

    async getStatus(input: { runId: string; tenantId: string }) {
      const run = await engine.getStatus(input.runId, input.tenantId)

      const def = engine.getWorkflows().get(run.workflowName)
      const sensitive = new Set(def?.sensitiveFields ?? [])
      const redact = (obj: any) => {
        if (!obj || sensitive.size === 0) {
          return obj
        }
        const result = { ...obj }
        for (const key of sensitive) {
          if (key in result) {
            result[key] = '[REDACTED]'
          }
        }
        return result
      }

      return {
        id: run.id,
        workflowName: run.workflowName,
        workflowVersion: run.workflowVersion,
        status: run.status,
        triggerInput: redact(run.triggerInput),
        output: run.output,
        error: run.error,
        startedAt:
          run.startedAt instanceof Date
            ? run.startedAt.toISOString()
            : run.startedAt
              ? String(run.startedAt)
              : null,
        completedAt:
          run.completedAt instanceof Date
            ? run.completedAt.toISOString()
            : run.completedAt
              ? String(run.completedAt)
              : null,
        createdAt:
          run.createdAt instanceof Date
            ? run.createdAt.toISOString()
            : String(run.createdAt),
        traceId: run.traceId ?? null,
        parentRunId: run.parentRunId ?? null,
        budget: run.budget ? fromJson(run.budget as any) : null,
        budgetUsed: run.budgetUsed ? fromJson(run.budgetUsed as any) : null,
        steps: run.steps.map(s => ({
          id: s.id,
          stepName: s.stepName,
          status: s.status,
          executorType: s.executorType,
          attempt: s.attempt,
          maxRetries: s.maxRetries,
          dependsOn: (s as any).dependsOn ?? [],
          input: redact(s.input),
          output: s.output,
          error: s.error,
          startedAt:
            s.startedAt instanceof Date
              ? s.startedAt.toISOString()
              : s.startedAt
                ? String(s.startedAt)
                : null,
          completedAt:
            s.completedAt instanceof Date
              ? s.completedAt.toISOString()
              : s.completedAt
                ? String(s.completedAt)
                : null,
          humanPrompt: s.humanPrompt,
          humanResponse: s.humanResponse,
          humanRespondedBy: s.humanRespondedBy,
          executedBy: s.executedBy ?? null,
        })),
      }
    },

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

    async query(input: {
      runId: string
      tenantId: string
      queryName: string
    }): Promise<Record<string, unknown>> {
      return engine.query(input.runId, input.tenantId, input.queryName)
    },

    async cancel(input: {
      runId: string
      tenantId: string
    }): Promise<{ success: true }> {
      await engine.cancel(input.runId, input.tenantId)
      return { success: true }
    },

    async cancelAll(input: {
      tenantId: string
      workflowName: string
      status: string[]
    }): Promise<{ cancelled: number }> {
      const now = new Date()

      const statusPlaceholders = input.status
        .map((_, i) => `$${i + 4}`)
        .join(',')
      const { rowCount } = await engine.db.query(
        `UPDATE workflow_runs SET status = $1, "completedAt" = $2, "updatedAt" = $3 WHERE "tenantId" = $${input.status.length + 4} AND "workflowName" = $${input.status.length + 5} AND status IN (${statusPlaceholders})`,
        [
          'CANCELLED',
          now,
          now,
          ...input.status,
          input.tenantId,
          input.workflowName,
        ],
      )

      await engine.db.query(
        `UPDATE workflow_steps SET status = $1, "updatedAt" = $2 WHERE "tenantId" = $3 AND status IN ('PENDING', 'QUEUED', 'RUNNING', 'WAITING_HUMAN') AND "workflowRunId" IN (SELECT id FROM workflow_runs WHERE "tenantId" = $3 AND "workflowName" = $4 AND status = 'CANCELLED')`,
        ['SKIPPED', now, input.tenantId, input.workflowName],
      )

      return { cancelled: rowCount ?? 0 }
    },

    async retry(input: {
      runId: string
      tenantId: string
    }): Promise<{ success: true; runId: string }> {
      await engine.retry(input.runId, input.tenantId)
      return { success: true, runId: input.runId }
    },

    async retryAll(input: {
      tenantId: string
      workflowName: string
      status: string[]
      batchSize?: number
    }): Promise<{ retried: number }> {
      const BATCH = input.batchSize ?? 100
      let retried = 0
      let cursor: string | null = null

      while (true) {
        let queryStr = `SELECT id, "createdAt" FROM workflow_runs WHERE "tenantId" = $1 AND "workflowName" = $2 AND status IN (${input.status.map((_, i) => `$${i + 3}`).join(',')}) ORDER BY "createdAt" ASC, id ASC LIMIT $${input.status.length + 3}`
        const params: any[] = [
          input.tenantId,
          input.workflowName,
          ...input.status,
          BATCH,
        ]

        if (cursor) {
          queryStr = `SELECT id, "createdAt" FROM workflow_runs WHERE "tenantId" = $1 AND "workflowName" = $2 AND status IN (${input.status.map((_, i) => `$${i + 3}`).join(',')}) AND id > $${input.status.length + 3} ORDER BY "createdAt" ASC, id ASC LIMIT $${input.status.length + 4}`
          params.push(cursor)
        }

        const { rows: batch } = await engine.db.query<{
          id: string
          createdAt: Date
        }>(queryStr, params)
        if (batch.length === 0) {
          break
        }

        for (const { id } of batch) {
          try {
            await engine.retry(id, input.tenantId)
            retried++
          } catch {
            // Skip runs that can't be retried
          }
        }

        cursor = batch[batch.length - 1]!.id
        if (batch.length < BATCH) {
          break
        }
      }

      return { retried }
    },

    async getStepLogs(input: {
      runId: string
      stepName: string
      tenantId: string
    }): Promise<
      Array<{ id: string; event: string; data?: unknown; createdAt: string }>
    > {
      const { rows } = await engine.db.query<{
        id: string
        event: string
        data: string | null
        createdAt: Date
      }>(
        `SELECT * FROM workflow_step_logs WHERE "stepId" IN (SELECT id FROM workflow_steps WHERE "workflowRunId" = $1 AND "stepName" = $2 AND "tenantId" = $3) ORDER BY "createdAt" ASC`,
        [input.runId, input.stepName, input.tenantId],
      )

      return rows.map(r => ({
        id: r.id,
        event: r.event,
        data: r.data ? fromJson(r.data) : undefined,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      }))
    },

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
        const valid = WebhookVerifier.verifyHmacSha256(
          payloadStr,
          input.signature,
          input.webhookSecret,
        )
        if (!valid) {
          throw new Error('Invalid webhook signature')
        }
      }
      return eventService.ingest({
        tenantId: input.tenantId,
        eventType: input.eventType,
        source: input.source,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
      })
    },

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

    async replayDeadLetterEvent(input: { eventId: string }) {
      return eventService.replayDeadLetter(input.eventId)
    },

    async getRunMetrics(input: { runId: string }) {
      return metricsCollector.getRunMetrics(input.runId)
    },

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
      tenantId?: string | null
      accountId?: string | null
      name: string
      hostname?: string
      capabilities?: Record<string, unknown>
    }): Promise<{ workerId: string }> {
      const id = randomUUID()
      await engine.db.query(
        `INSERT INTO worker_nodes (id, "tenantId", "accountId", name, hostname, capabilities, status, "lastHeartbeatAt", "registeredAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          input.tenantId ?? null,
          input.accountId ?? null,
          input.name,
          input.hostname ?? null,
          toJson(input.capabilities ?? null),
          'active',
          new Date(),
          new Date(),
        ],
      )
      return { workerId: id }
    },

    async workerHeartbeat(input: {
      workerId: string
    }): Promise<{ success: true }> {
      await engine.db.query(
        `UPDATE worker_nodes SET "lastHeartbeatAt" = $1 WHERE id = $2`,
        [new Date(), input.workerId],
      )
      return { success: true }
    },

    async updateWorkerQueues(input: { workerId: string; queues: string[] }) {
      const { rows } = await engine.db.query(
        `SELECT * FROM worker_nodes WHERE id = $1`,
        [input.workerId],
      )
      const row = rows[0] as any
      if (!row) {
        throw new Error('Worker not found')
      }
      const caps = row.capabilities ? JSON.parse(row.capabilities) : {}
      caps.queues = input.queues
      await engine.db.query(
        `UPDATE worker_nodes SET capabilities = $1 WHERE id = $2`,
        [JSON.stringify(caps), input.workerId],
      )
      return { success: true }
    },

    async listWorkers(input: { tenantId: string }) {
      const { rows } = await engine.db.query(
        `SELECT * FROM worker_nodes WHERE "tenantId" = $1 OR "tenantId" IS NULL`,
        [input.tenantId],
      )

      const STALE_THRESHOLD_MS = 45_000
      const now = Date.now()

      return rows
        .map((r: any) => {
          let status = r.status
          if (status === 'active' && r.lastHeartbeatAt) {
            const lastBeat = new Date(r.lastHeartbeatAt).getTime()
            if (now - lastBeat > STALE_THRESHOLD_MS) {
              status = 'offline'
            }
          }
          return {
            id: r.id,
            name: r.name,
            hostname: r.hostname,
            capabilities: fromJson(r.capabilities),
            status,
            lastHeartbeatAt: r.lastHeartbeatAt
              ? String(r.lastHeartbeatAt)
              : null,
            registeredAt: String(r.registeredAt),
          }
        })
        .filter((w: any) => w.status !== 'offline')
    },

    async generateWorkerToken(input: {
      tenantId: string
      engineUrl: string
      queues?: string[]
      labels?: string[]
    }): Promise<{
      token: string
      installCommand: string
      startCommand: string
      engineUrl: string
    }> {
      const { randomBytes, createHash } = await import('node:crypto')
      const token = randomBytes(32).toString('hex')

      const tokenHash = createHash('sha256').update(token).digest('hex')
      const id = randomBytes(16).toString('base64url').slice(0, 21)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await engine.db.query(
        `INSERT INTO agent_tokens (id, "tenantId", token, used, "usedBy", "expiresAt") VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, input.tenantId, tokenHash, false, null, expiresAt],
      )

      const installCommand = `curl -fsSL ${input.engineUrl}/agent/install.sh | bash`
      const queueParam = input.queues?.length
        ? `&queues=${input.queues.join(',')}`
        : ''
      const labelParam = input.labels?.length
        ? `&labels=${input.labels.join(',')}`
        : ''
      const startCommand = `curl -fsSL '${input.engineUrl}/agent/run?token=${token}${queueParam}${labelParam}' | node`

      return { token, installCommand, startCommand, engineUrl: input.engineUrl }
    },

    async deregisterWorker(input: {
      workerId: string
    }): Promise<{ success: true }> {
      await engine.db.query(
        `UPDATE worker_nodes SET status = $1 WHERE id = $2`,
        ['offline', input.workerId],
      )
      return { success: true }
    },

    // ── Validation ─────────────────────────────────────────────────

    async validateDefinition(input: {
      definition: Record<string, unknown>
    }): Promise<{ valid: boolean; errors: string[] }> {
      const errors: string[] = []
      const def = input.definition
      if (
        !def.name ||
        typeof def.name !== 'string' ||
        (def.name as string).trim() === ''
      ) {
        errors.push('Workflow name is required')
      }
      if (!def.version || typeof def.version !== 'string') {
        errors.push('Workflow version is required')
      }
      if (!Array.isArray(def.steps) || def.steps.length === 0) {
        errors.push('Workflow must have at least one step')
        return { valid: false, errors }
      }
      const steps = def.steps as Record<string, unknown>[]
      const names = new Set<string>()
      for (const step of steps) {
        if (!step.name || typeof step.name !== 'string') {
          errors.push('Each step must have a name')
          continue
        }
        if (names.has(step.name as string)) {
          errors.push(`Duplicate step name: "${step.name}"`)
        }
        names.add(step.name as string)
        const deps = (step.dependsOn ?? []) as string[]
        for (const dep of deps) {
          if (!steps.some(s => s.name === dep)) {
            errors.push(`Step "${step.name}" depends on unknown step "${dep}"`)
          }
          if (dep === step.name) {
            errors.push(`Step "${step.name}" depends on itself`)
          }
        }
      }
      return { valid: errors.length === 0, errors }
    },
  }
}

export type WorkflowHandlers = ReturnType<typeof createWorkflowHandlers>

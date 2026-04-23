// Event Ingestion Service — idempotent event storage, dead-letter queue, subscriptions
// npx vitest run src/__tests__/engine/event-ingestion.spec.ts

import type { JsonObject } from '@goatlab/tasks-core'
import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type { WorkflowEvent } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import type {
  EventSubscription,
  IncomingEvent,
} from './EventIngestion.types.js'

export interface EventIngestionConfig {
  db: DbClient
  maxRetries?: number
  skipAutoProcess?: boolean
  logger?: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

export class EventIngestionService {
  private db: DbClient
  private maxRetries: number
  private skipAutoProcess: boolean
  private logger?: EventIngestionConfig['logger']
  private engine: WorkflowEngine | null = null

  constructor(config: EventIngestionConfig) {
    this.db = config.db
    this.maxRetries = config.maxRetries ?? 3
    this.skipAutoProcess = config.skipAutoProcess ?? false
    this.logger = config.logger
  }

  setEngine(engine: WorkflowEngine): void {
    this.engine = engine
  }

  async ingest(
    event: IncomingEvent,
  ): Promise<{ eventId: string; duplicate: boolean; skipped?: boolean }> {
    const eventId = nanoId(21)

    if (event.idempotencyKey) {
      const { rows } = await this.db.query<{ id: string }>(
        `SELECT id FROM workflow_events WHERE "idempotencyKey" = $1`,
        [event.idempotencyKey],
      )
      if (rows[0]) {
        this.logger?.info(
          `Duplicate event idempotencyKey=${event.idempotencyKey}`,
        )
        return { eventId: rows[0].id, duplicate: true }
      }
    }

    try {
      // ── Ordering check: skip stale events ──────────────────
      if (event.entityKey && event.sequenceNumber !== undefined) {
        const { rows: newerRows } = await this.db.query<{ id: string }>(
          `SELECT id FROM workflow_events WHERE "entityKey" = $1 AND "sequenceNumber" > $2 AND status IN ('processed', 'completing') LIMIT 1`,
          [event.entityKey, event.sequenceNumber],
        )

        if (newerRows[0]) {
          await this.db.query(
            `INSERT INTO workflow_events (id, "tenantId", "eventType", source, payload, "idempotencyKey", "entityKey", "sequenceNumber", "traceId", status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              eventId,
              event.tenantId,
              event.eventType,
              event.source,
              toJson(event.payload),
              event.idempotencyKey ?? null,
              event.entityKey,
              event.sequenceNumber,
              event.traceId ?? null,
              'skipped_stale',
            ],
          )

          this.logger?.info(
            `Skipped stale event: ${event.eventType} entity=${event.entityKey} seq=${event.sequenceNumber} (newer exists)`,
          )
          return { eventId, duplicate: false, skipped: true }
        }
      }

      await this.db.query(
        `INSERT INTO workflow_events (id, "tenantId", "eventType", source, payload, "idempotencyKey", "entityKey", "sequenceNumber", "traceId", status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          eventId,
          event.tenantId,
          event.eventType,
          event.source,
          toJson(event.payload),
          event.idempotencyKey ?? null,
          event.entityKey ?? null,
          event.sequenceNumber ?? null,
          event.traceId ?? null,
          'pending',
        ],
      )

      if (!this.skipAutoProcess) {
        await this.processEvent(eventId)
      }
      return { eventId, duplicate: false }
    } catch (err: any) {
      if (
        event.idempotencyKey &&
        (err.code === '23505' ||
          err.message?.includes('unique') ||
          err.message?.includes('UNIQUE'))
      ) {
        const { rows } = await this.db.query<{ id: string }>(
          `SELECT id FROM workflow_events WHERE "idempotencyKey" = $1`,
          [event.idempotencyKey],
        )
        if (rows[0]) {
          return { eventId: rows[0].id, duplicate: true }
        }
      }
      throw err
    }
  }

  async processEvent(eventId: string): Promise<void> {
    const { rows: eventRows } = await this.db.query<WorkflowEvent>(
      `SELECT * FROM workflow_events WHERE id = $1`,
      [eventId],
    )
    const event = eventRows[0]
    if (!event) {
      throw new Error(`Event not found: ${eventId}`)
    }

    const { rows: _subscriptions } = await this.db.query(
      `SELECT * FROM workflow_event_subscriptions WHERE "tenantId" = $1 AND "eventType" = $2 AND active = true`,
      [event.tenantId, event.eventType],
    )

    // Trigger workflows that have matching event triggers
    if (this.engine) {
      const payload = fromJson<JsonObject>(event.payload) ?? {}
      for (const [name, def] of this.engine.getWorkflows()) {
        for (const trigger of def.triggers ?? []) {
          if (
            trigger.type === 'event' &&
            trigger.eventType === event.eventType
          ) {
            if (trigger.filter && !trigger.filter(payload)) {
              continue
            }

            const input = trigger.mapTriggerInput
              ? trigger.mapTriggerInput(payload)
              : payload

            const wfIdempotencyKey = event.idempotencyKey
              ? `trigger:${name}:${event.idempotencyKey}`
              : undefined

            try {
              await this.engine.start({
                workflowName: name,
                tenantId: event.tenantId,
                input: input as JsonObject,
                idempotencyKey: wfIdempotencyKey,
              })
              this.logger?.info(
                `Triggered workflow ${name} from event ${event.eventType}`,
              )
            } catch (err: any) {
              if (err.name !== 'IdempotencyConflictError') {
                throw err
              }
            }
          }
        }
      }
    }

    // Handle human.response events
    if (event.eventType === 'human.response' && this.engine) {
      const hrPayload = fromJson<JsonObject>(event.payload) ?? {}
      const { workflowRunId, stepName, data, respondedBy } = hrPayload as any
      if (workflowRunId && stepName && data) {
        await this.engine.submitHumanInput({
          workflowRunId,
          stepName,
          tenantId: event.tenantId,
          data,
          respondedBy,
        })
      }
    }

    await this.db.query(
      `UPDATE workflow_events SET status = $1, "processedAt" = $2 WHERE id = $3`,
      ['processed', new Date(), eventId],
    )
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE workflow_events SET status = $1, error = $2 WHERE id = $3`,
      ['failed', error, eventId],
    )
  }

  async markDeadLetter(eventId: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE workflow_events SET status = $1, error = $2 WHERE id = $3`,
      ['dead_letter', error, eventId],
    )
  }

  async listDeadLetters(
    tenantId: string,
    opts?: { eventType?: string; limit?: number },
  ): Promise<WorkflowEvent[]> {
    let queryStr = `SELECT * FROM workflow_events WHERE "tenantId" = $1 AND status = 'dead_letter'`
    const params: any[] = [tenantId]
    let paramIdx = 2

    if (opts?.eventType) {
      queryStr += ` AND "eventType" = $${paramIdx}`
      params.push(opts.eventType)
      paramIdx++
    }

    queryStr += ` ORDER BY "createdAt" DESC LIMIT $${paramIdx}`
    params.push(opts?.limit ?? 100)

    const { rows } = await this.db.query<WorkflowEvent>(queryStr, params)
    return rows
  }

  async replayDeadLetter(eventId: string): Promise<{ eventId: string }> {
    await this.db.query(
      `UPDATE workflow_events SET status = $1, error = $2, "processedAt" = $3 WHERE id = $4 AND status = 'dead_letter'`,
      ['pending', null, null, eventId],
    )
    return { eventId }
  }

  async subscribe(
    tenantId: string,
    eventType: string,
    workflowName: string,
    filter?: Record<string, unknown>,
  ): Promise<string> {
    const id = nanoId(21)
    await this.db.query(
      `INSERT INTO workflow_event_subscriptions (id, "tenantId", "eventType", "workflowName", "filterExpression", active) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        tenantId,
        eventType,
        workflowName,
        filter ? toJson(filter) : null,
        true,
      ],
    )
    return id
  }

  async getSubscriptions(
    tenantId: string,
    eventType: string,
  ): Promise<EventSubscription[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM workflow_event_subscriptions WHERE "tenantId" = $1 AND "eventType" = $2 AND active = true`,
      [tenantId, eventType],
    )

    return rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      eventType: r.eventType,
      workflowName: r.workflowName,
      filterExpression:
        fromJson<Record<string, unknown>>(
          r.filterExpression as string | null,
        ) ?? undefined,
      active: r.active,
    }))
  }

  async getLatestSequence(entityKey: string): Promise<number | null> {
    const { rows } = await this.db.query<{ sequenceNumber: number | null }>(
      `SELECT "sequenceNumber" FROM workflow_events WHERE "entityKey" = $1 AND status IN ('processed', 'completing') AND "sequenceNumber" IS NOT NULL ORDER BY "sequenceNumber" DESC LIMIT 1`,
      [entityKey],
    )
    return rows[0]?.sequenceNumber ?? null
  }
}

// Event Ingestion Service — idempotent event storage, dead-letter queue, subscriptions
// npx vitest run src/__tests__/engine/event-ingestion.spec.ts

import { Ids } from '@goatlab/js-utils'
import type { Kysely } from 'kysely'
import type { JsonObject } from '@goatlab/tasks-core'
import type { Database, WorkflowEvent } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import type { WorkflowEngine } from '../engine/WorkflowEngine.js'
import type {
  EventSubscription,
  IncomingEvent,
} from './EventIngestion.types.js'

export interface EventIngestionConfig {
  db: Kysely<Database>
  maxRetries?: number
  /** Skip auto-processing after ingest (for high-throughput ingestion without triggers) */
  skipAutoProcess?: boolean
  logger?: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

export class EventIngestionService {
  private db: Kysely<Database>
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

  /** Wire to the workflow engine for trigger-based workflow starts */
  setEngine(engine: WorkflowEngine): void {
    this.engine = engine
  }

  /**
   * Ingest an event idempotently.
   * If a duplicate idempotencyKey is found, returns the existing event ID.
   */
  async ingest(
    event: IncomingEvent,
  ): Promise<{ eventId: string; duplicate: boolean; skipped?: boolean }> {
    const eventId = Ids.nanoId(21)

    // If there's an idempotency key, check for existing first
    if (event.idempotencyKey) {
      const existing = await this.db
        .selectFrom('workflow_events')
        .select('id')
        .where('idempotencyKey', '=', event.idempotencyKey)
        .executeTakeFirst()

      if (existing) {
        this.logger?.info(
          `Duplicate event idempotencyKey=${event.idempotencyKey}`,
        )
        return { eventId: existing.id, duplicate: true }
      }
    }

    try {
      // ── Ordering check: skip stale events ──────────────────
      if (event.entityKey && event.sequenceNumber !== undefined) {
        const newer = await this.db
          .selectFrom('workflow_events')
          .select('id')
          .where('entityKey', '=', event.entityKey)
          .where('sequenceNumber', '>', event.sequenceNumber)
          .where('status', 'in', ['processed', 'completing'])
          .executeTakeFirst()

        if (newer) {
          // A newer event for this entity was already processed — skip
          await this.db.insertInto('workflow_events').values({
            id: eventId,
            tenantId: event.tenantId,
            eventType: event.eventType,
            source: event.source,
            payload: toJson(event.payload),
            idempotencyKey: event.idempotencyKey ?? null,
            entityKey: event.entityKey,
            sequenceNumber: event.sequenceNumber,
            traceId: event.traceId ?? null,
            status: 'skipped_stale',
          }).execute()

          this.logger?.info(
            `Skipped stale event: ${event.eventType} entity=${event.entityKey} seq=${event.sequenceNumber} (newer exists)`,
          )
          return { eventId, duplicate: false, skipped: true }
        }
      }

      await this.db
        .insertInto('workflow_events')
        .values({
          id: eventId,
          tenantId: event.tenantId,
          eventType: event.eventType,
          source: event.source,
          payload: toJson(event.payload),
          idempotencyKey: event.idempotencyKey ?? null,
          entityKey: event.entityKey ?? null,
          sequenceNumber: event.sequenceNumber ?? null,
          traceId: event.traceId ?? null,
          status: 'pending',
        })
        .execute()

      // Auto-process for trigger matching (skippable for high-throughput ingestion)
      if (!this.skipAutoProcess) {
        await this.processEvent(eventId)
      }
      return { eventId, duplicate: false }
    } catch (err: any) {
      // Handle race condition: unique constraint violation on idempotencyKey
      if (
        event.idempotencyKey &&
        (err.code === '23505' ||
          err.message?.includes('unique') ||
          err.message?.includes('UNIQUE'))
      ) {
        const existing = await this.db
          .selectFrom('workflow_events')
          .select('id')
          .where('idempotencyKey', '=', event.idempotencyKey)
          .executeTakeFirst()
        if (existing) {
          return { eventId: existing.id, duplicate: true }
        }
      }
      throw err
    }
  }

  /**
   * Process an event: find matching subscriptions and mark as processed.
   * (Phase 3 will add workflow triggering here.)
   */
  async processEvent(eventId: string): Promise<void> {
    const event = await this.db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst()

    if (!event) throw new Error(`Event not found: ${eventId}`)

    // Find matching subscriptions
    const _subscriptions = await this.db
      .selectFrom('workflow_event_subscriptions')
      .selectAll()
      .where('tenantId', '=', event.tenantId)
      .where('eventType', '=', event.eventType)
      .where('active', '=', true)
      .execute()

    // Trigger workflows that have matching event triggers
    if (this.engine) {
      const payload = fromJson<JsonObject>(event.payload) ?? {}
      for (const [name, def] of this.engine.getWorkflows()) {
        for (const trigger of def.triggers ?? []) {
          if (trigger.type === 'event' && trigger.eventType === event.eventType) {
            // Apply filter if defined
            if (trigger.filter && !trigger.filter(payload)) continue

            // Map input if defined
            const input = trigger.mapTriggerInput ? trigger.mapTriggerInput(payload) : payload

            // Use event idempotencyKey to prevent duplicate workflow starts
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
              this.logger?.info(`Triggered workflow ${name} from event ${event.eventType}`)
            } catch (err: any) {
              // Swallow idempotency conflicts (duplicate events)
              if (err.name !== 'IdempotencyConflictError') throw err
            }
          }
        }
      }
    }

    // Handle human.response events — bridge to submitHumanInput
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

    await this.db
      .updateTable('workflow_events')
      .set({ status: 'processed', processedAt: new Date() })
      .where('id', '=', eventId)
      .execute()
  }

  /**
   * Mark an event as failed.
   */
  async markFailed(eventId: string, error: string): Promise<void> {
    await this.db
      .updateTable('workflow_events')
      .set({ status: 'failed', error })
      .where('id', '=', eventId)
      .execute()
  }

  /**
   * Mark an event as dead letter (permanently failed).
   */
  async markDeadLetter(eventId: string, error: string): Promise<void> {
    await this.db
      .updateTable('workflow_events')
      .set({ status: 'dead_letter', error })
      .where('id', '=', eventId)
      .execute()
  }

  /**
   * List dead letter events for a tenant.
   */
  async listDeadLetters(
    tenantId: string,
    opts?: { eventType?: string; limit?: number },
  ): Promise<WorkflowEvent[]> {
    let query = this.db
      .selectFrom('workflow_events')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .where('status', '=', 'dead_letter')

    if (opts?.eventType) {
      query = query.where('eventType', '=', opts.eventType)
    }

    return query
      .orderBy('createdAt', 'desc')
      .limit(opts?.limit ?? 100)
      .execute()
  }

  /**
   * Replay a dead-letter event by resetting its status to pending.
   */
  async replayDeadLetter(eventId: string): Promise<{ eventId: string }> {
    await this.db
      .updateTable('workflow_events')
      .set({ status: 'pending', error: null, processedAt: null })
      .where('id', '=', eventId)
      .where('status', '=', 'dead_letter')
      .execute()

    return { eventId }
  }

  /**
   * Subscribe a workflow to an event type.
   */
  async subscribe(
    tenantId: string,
    eventType: string,
    workflowName: string,
    filter?: Record<string, unknown>,
  ): Promise<string> {
    const id = Ids.nanoId(21)

    await this.db
      .insertInto('workflow_event_subscriptions')
      .values({
        id,
        tenantId,
        eventType,
        workflowName,
        filterExpression: filter ? toJson(filter) : null,
        active: true,
      })
      .execute()

    return id
  }

  /**
   * Get active subscriptions for a tenant + event type.
   */
  async getSubscriptions(
    tenantId: string,
    eventType: string,
  ): Promise<EventSubscription[]> {
    const rows = await this.db
      .selectFrom('workflow_event_subscriptions')
      .selectAll()
      .where('tenantId', '=', tenantId)
      .where('eventType', '=', eventType)
      .where('active', '=', true)
      .execute()

    return rows.map(r => ({
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

  /**
   * Get the latest processed sequence number for an entity.
   * Returns null if no events have been processed for this entity.
   */
  async getLatestSequence(entityKey: string): Promise<number | null> {
    const row = await this.db
      .selectFrom('workflow_events')
      .select('sequenceNumber')
      .where('entityKey', '=', entityKey)
      .where('status', 'in', ['processed', 'completing'])
      .where('sequenceNumber', 'is not', null)
      .orderBy('sequenceNumber', 'desc')
      .limit(1)
      .executeTakeFirst()

    return row?.sequenceNumber ?? null
  }
}

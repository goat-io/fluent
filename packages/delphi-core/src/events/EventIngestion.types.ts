// Event Ingestion types for the workflow engine
// npx vitest run src/__tests__/engine/event-ingestion.spec.ts

export interface IncomingEvent {
  tenantId: string
  eventType: string // e.g. 'github.pr.opened', 'linear.issue.created'
  source: string // e.g. 'github', 'linear', 'manual'
  payload: Record<string, unknown>
  idempotencyKey?: string
  /**
   * Entity key for ordering — groups related events on the same entity.
   * e.g. 'github:pr:123', 'linear:issue:ABC-456'
   * Events with the same entityKey are processed in sequenceNumber order.
   */
  entityKey?: string
  /**
   * Sequence number within an entity. Higher = newer.
   * Used with entityKey for ordering guarantees.
   * If an event arrives with a sequence lower than the last processed
   * for this entity, it is skipped (last-write-wins).
   */
  sequenceNumber?: number
  /** Trace ID for cross-workflow lineage */
  traceId?: string
}

export interface EventSubscription {
  id: string
  tenantId: string
  eventType: string
  workflowName: string
  filterExpression?: Record<string, unknown>
  active: boolean
}

export type EventStatus = 'pending' | 'processed' | 'failed' | 'dead_letter'

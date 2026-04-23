// npx vitest run src/__tests__/engine/event-ingestion.spec.ts

import { createHmac } from 'node:crypto'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { EventIngestionService } from '../../events/EventIngestion.js'
import { WebhookVerifier } from '../../events/WebhookVerifier.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('EventIngestionService', () => {
  let db: TestDb
  let service: EventIngestionService

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    service = new EventIngestionService({ db })
  })

  // ── Ingestion ──────────────────────────────────────────────────

  it('ingests event successfully', async () => {
    const result = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 42 },
    })

    expect(result.eventId).toBeDefined()
    expect(result.duplicate).toBe(false)

    const row = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', result.eventId)
      .executeTakeFirst()

    expect(row).toBeDefined()
    expect(row!.status).toBe('processed') // auto-processed after ingest
    expect(row!.eventType).toBe('github.pr.opened')
    expect(row!.source).toBe('github')
  })

  it('duplicate idempotencyKey returns existing', async () => {
    const first = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 42 },
      idempotencyKey: 'key-1',
    })

    const second = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 42 },
      idempotencyKey: 'key-1',
    })

    expect(second.duplicate).toBe(true)
    expect(second.eventId).toBe(first.eventId)
  })

  it('event without idempotencyKey always inserts', async () => {
    const r1 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 1 },
    })

    const r2 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 2 },
    })

    expect(r1.duplicate).toBe(false)
    expect(r2.duplicate).toBe(false)
    expect(r1.eventId).not.toBe(r2.eventId)
  })

  // ── Webhook Verification ───────────────────────────────────────

  it('HMAC verification passes with correct signature', () => {
    const secret = 'my-secret'
    const payload = '{"action":"opened"}'
    const signature = createHmac('sha256', secret).update(payload).digest('hex')

    expect(WebhookVerifier.verifyHmacSha256(payload, signature, secret)).toBe(
      true,
    )
  })

  it('HMAC verification fails with wrong signature', () => {
    const secret = 'my-secret'
    const payload = '{"action":"opened"}'

    expect(
      WebhookVerifier.verifyHmacSha256(payload, 'deadbeef'.repeat(8), secret),
    ).toBe(false)
  })

  it('GitHub webhook verification with sha256= prefix', () => {
    const secret = 'gh-secret'
    const payload = '{"action":"opened","number":1}'
    const hex = createHmac('sha256', secret).update(payload).digest('hex')
    const header = `sha256=${hex}`

    expect(WebhookVerifier.verifyGitHub(payload, header, secret)).toBe(true)
  })

  // ── Dead Letter Queue ──────────────────────────────────────────

  it('marks event as dead letter', async () => {
    const { eventId } = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 1 },
    })

    await service.markDeadLetter(eventId, 'Max retries exceeded')

    const row = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst()

    expect(row!.status).toBe('dead_letter')
    expect(row!.error).toBe('Max retries exceeded')
  })

  it('lists dead letter events filtered by tenantId and eventType', async () => {
    const { eventId: e1 } = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 1 },
    })
    const { eventId: e2 } = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'linear.issue.created',
      source: 'linear',
      payload: { issue: 1 },
    })
    const { eventId: e3 } = await service.ingest({
      tenantId: 'tenant-2',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 2 },
    })

    await service.markDeadLetter(e1, 'err1')
    await service.markDeadLetter(e2, 'err2')
    await service.markDeadLetter(e3, 'err3')

    const all = await service.listDeadLetters('tenant-1')
    expect(all).toHaveLength(2)

    const filtered = await service.listDeadLetters('tenant-1', {
      eventType: 'github.pr.opened',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe(e1)
  })

  it('replays dead letter by resetting status to pending', async () => {
    const { eventId } = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 1 },
    })

    await service.markDeadLetter(eventId, 'retries exceeded')
    const result = await service.replayDeadLetter(eventId)
    expect(result.eventId).toBe(eventId)

    const row = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst()

    expect(row!.status).toBe('pending')
    expect(row!.error).toBeNull()
  })

  // ── Subscriptions ──────────────────────────────────────────────

  it('subscribes to event type and retrieves subscription', async () => {
    const subId = await service.subscribe(
      'tenant-1',
      'github.pr.opened',
      'code-review-workflow',
      { branch: 'main' },
    )

    expect(subId).toBeDefined()

    const subs = await service.getSubscriptions('tenant-1', 'github.pr.opened')
    expect(subs).toHaveLength(1)
    expect(subs[0].workflowName).toBe('code-review-workflow')
    expect(subs[0].filterExpression).toEqual({ branch: 'main' })
    expect(subs[0].active).toBe(true)
  })

  // ── Human Response Events ──────────────────────────────────────

  it('human.response event calls engine.submitHumanInput()', async () => {
    const mockEngine = {
      submitHumanInput: async (_input: any) => {},
      getWorkflows: () => new Map(),
      start: async () => ({ runId: 'r' }),
    } as any

    const submitSpy = vi.fn()
    mockEngine.submitHumanInput = submitSpy

    const svc = new EventIngestionService({ db })
    svc.setEngine(mockEngine)

    const result = await svc.ingest({
      tenantId: 'tenant-1',
      eventType: 'human.response',
      source: 'ui',
      payload: {
        workflowRunId: 'run-123',
        stepName: 'review_step',
        data: { approved: true },
        respondedBy: 'user@example.com',
      },
    })

    expect(result.duplicate).toBe(false)
    expect(submitSpy).toHaveBeenCalledOnce()
    expect(submitSpy).toHaveBeenCalledWith({
      workflowRunId: 'run-123',
      stepName: 'review_step',
      tenantId: 'tenant-1',
      data: { approved: true },
      respondedBy: 'user@example.com',
    })
  })

  it('human.response event without engine is a no-op', async () => {
    // No engine set — should not throw
    const svc = new EventIngestionService({ db })

    const result = await svc.ingest({
      tenantId: 'tenant-1',
      eventType: 'human.response',
      source: 'ui',
      payload: {
        workflowRunId: 'run-123',
        stepName: 'review_step',
        data: { approved: true },
      },
    })

    expect(result.duplicate).toBe(false)
  })

  it('human.response event without required fields is a no-op', async () => {
    const mockEngine = {
      submitHumanInput: vi.fn(),
      getWorkflows: () => new Map(),
    } as any

    const svc = new EventIngestionService({ db })
    svc.setEngine(mockEngine)

    // Missing stepName
    await svc.ingest({
      tenantId: 'tenant-1',
      eventType: 'human.response',
      source: 'ui',
      payload: { workflowRunId: 'run-123', data: { approved: true } },
    })

    expect(mockEngine.submitHumanInput).not.toHaveBeenCalled()
  })

  // ── Event Ordering ─────────────────────────────────────────────

  it('events with entityKey+sequenceNumber are processed in order', async () => {
    // Process event with seq=1
    const r1 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'opened' },
      entityKey: 'github:pr:42',
      sequenceNumber: 1,
    })
    expect(r1.duplicate).toBe(false)
    expect(r1.skipped).toBeUndefined()

    // Process event with seq=2
    const r2 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'updated' },
      entityKey: 'github:pr:42',
      sequenceNumber: 2,
    })
    expect(r2.skipped).toBeUndefined()

    // Both should be processed
    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('entityKey', '=', 'github:pr:42')
      .orderBy('sequenceNumber', 'asc')
      .execute()

    expect(events).toHaveLength(2)
    expect(events[0].status).toBe('processed')
    expect(events[1].status).toBe('processed')
  })

  it('stale event (lower sequence) is skipped when newer exists', async () => {
    // First process seq=3 (arrives first, out of order)
    await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'closed' },
      entityKey: 'github:pr:99',
      sequenceNumber: 3,
    })

    // Then seq=1 arrives (stale — seq 3 already processed)
    const stale = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'opened' },
      entityKey: 'github:pr:99',
      sequenceNumber: 1,
    })

    expect(stale.skipped).toBe(true)

    // Stale event should be stored with status 'skipped_stale'
    const events = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('entityKey', '=', 'github:pr:99')
      .orderBy('sequenceNumber', 'asc')
      .execute()

    expect(events).toHaveLength(2)
    expect(events.find(e => e.sequenceNumber === 1)!.status).toBe(
      'skipped_stale',
    )
    expect(events.find(e => e.sequenceNumber === 3)!.status).toBe('processed')
  })

  it('getLatestSequence returns highest processed sequence', async () => {
    await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'opened' },
      entityKey: 'github:pr:77',
      sequenceNumber: 1,
    })
    await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.updated',
      source: 'github',
      payload: { action: 'updated' },
      entityKey: 'github:pr:77',
      sequenceNumber: 5,
    })

    const latest = await service.getLatestSequence('github:pr:77')
    expect(latest).toBe(5)
  })

  it('getLatestSequence returns null for unknown entity', async () => {
    const latest = await service.getLatestSequence('unknown:entity')
    expect(latest).toBeNull()
  })

  it('events without entityKey bypass ordering checks', async () => {
    // Events without entityKey should always process (no ordering)
    const r1 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'manual.trigger',
      source: 'manual',
      payload: { data: 'first' },
    })
    const r2 = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'manual.trigger',
      source: 'manual',
      payload: { data: 'second' },
    })

    expect(r1.skipped).toBeUndefined()
    expect(r2.skipped).toBeUndefined()
  })

  // ── Process Event ──────────────────────────────────────────────

  it('processEvent marks event as processed', async () => {
    const { eventId } = await service.ingest({
      tenantId: 'tenant-1',
      eventType: 'github.pr.opened',
      source: 'github',
      payload: { pr: 99 },
    })

    await service.processEvent(eventId)

    const row = await db
      .selectFrom('workflow_events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst()

    expect(row!.status).toBe('processed')
    expect(row!.processedAt).toBeDefined()
  })
})

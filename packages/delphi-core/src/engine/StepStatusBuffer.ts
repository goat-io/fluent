// Batched step status writer (Hatchet pattern).
//
// Step lifecycle today: each step transition (PENDING→QUEUED→RUNNING→COMPLETED/FAILED)
// fires a synchronous UPDATE workflow_steps SET status = ? WHERE id = ?.
// Under load, that's N round-trips per second — each holding a PG client.
//
// This buffer accumulates pending updates and flushes them as a SINGLE
// UPDATE … FROM (unnest($ids, $statuses, …)) AS v WHERE id = v.id, then
// resolves the per-step promise that the caller is awaiting.
//
// Critical invariant: the returned promise must resolve ONLY after the UPDATE
// has been COMMITTED. Otherwise BullMQ would ack a step job whose status
// change is still in volatile in-process memory; a crash would silently lose
// the COMPLETED state. The caller (WorkflowStepTask) awaits this promise
// before returning from handle(), so BullMQ ack ↔ PG commit stay coupled.
//
// npx vitest run src/__tests__/engine/step-status-buffer.spec.ts

import type { Pool } from 'pg'
import { BatchedJobProcessor } from './BatchedJobProcessor.js'

export interface StepStatusUpdate {
  stepId: string
  /** New status — required */
  status: string
  /** JSON-stringified output column. Pass `null` to leave unchanged; pass `''` to clear. */
  output?: string | null
  /** Free-text error column. Same null/empty semantics as output. */
  error?: string | null
  /** Set when transitioning to RUNNING */
  startedAt?: Date | null
  /** Set when transitioning to a terminal state */
  completedAt?: Date | null
  /** humanPrompt column (JSON-stringified) — only used for WAITING_HUMAN transitions */
  humanPrompt?: string | null
  /** Worker identity (hostname:pid) — set when transitioning to RUNNING */
  executedBy?: string | null
}

export interface StepStatusBufferConfig {
  pgPool: Pool
  /** Flush when this many updates buffered. Default 100. */
  flushThreshold?: number
  /** Max ms to hold an update waiting for batch fill. Default 20ms. */
  flushIntervalMs?: number
  /** Max in-flight UPDATE statements. Default 4 (each holds a PG client). */
  maxConcurrentFlushes?: number
  /**
   * Postgres schema for the workflow_steps table. When set, SQL becomes
   * `UPDATE <schema>.workflow_steps`. Default: no schema prefix.
   */
  schema?: string
  logger?: {
    info?: (...a: unknown[]) => void
    error?: (...a: unknown[]) => void
  }
}

export class StepStatusBuffer {
  private readonly pgPool: Pool
  private readonly tableName: string
  private readonly processor: BatchedJobProcessor<StepStatusUpdate, void>

  constructor(config: StepStatusBufferConfig) {
    this.pgPool = config.pgPool
    this.tableName = config.schema
      ? `${config.schema}.workflow_steps`
      : 'workflow_steps'
    this.processor = new BatchedJobProcessor<StepStatusUpdate, void>({
      name: 'StepStatusBuffer',
      flushThreshold: config.flushThreshold ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 20,
      maxConcurrentFlushes: config.maxConcurrentFlushes ?? 4,
      logger: config.logger,
      flushBatch: async batch => {
        await this.commitBatch(batch)
        // void result for each item — promise resolves when the batched
        // UPDATE commits, callers don't need a per-item value
        return new Array(batch.length).fill(undefined as undefined)
      },
    })
  }

  /**
   * Enqueue a status update. Returns a promise that resolves once the UPDATE
   * has been COMMITTED to Postgres. Reject signals a permanent failure
   * (caller should fail the BullMQ job).
   */
  enqueue(update: StepStatusUpdate): Promise<void> {
    return this.processor.enqueue(update)
  }

  async shutdown(): Promise<void> {
    await this.processor.shutdown()
  }

  currentDepth(): number {
    return this.processor.pendingCount()
  }

  private async commitBatch(batch: StepStatusUpdate[]): Promise<void> {
    // Build six parallel arrays for unnest. PG arrays accept NULL elements.
    const ids: string[] = new Array(batch.length)
    const statuses: string[] = new Array(batch.length)
    const outputs: (string | null)[] = new Array(batch.length)
    const errors: (string | null)[] = new Array(batch.length)
    const completedAts: (string | null)[] = new Array(batch.length)
    const startedAts: (string | null)[] = new Array(batch.length)
    const humanPrompts: (string | null)[] = new Array(batch.length)
    const executedBys: (string | null)[] = new Array(batch.length)

    for (let i = 0; i < batch.length; i++) {
      const u = batch[i]!
      ids[i] = u.stepId
      statuses[i] = u.status
      // null in our protocol = "leave column unchanged" (CASE in SQL handles it).
      // We coerce undefined → null for PG bindings.
      outputs[i] = u.output ?? null
      errors[i] = u.error ?? null
      completedAts[i] = u.completedAt ? u.completedAt.toISOString() : null
      startedAts[i] = u.startedAt ? u.startedAt.toISOString() : null
      humanPrompts[i] = u.humanPrompt ?? null
      executedBys[i] = u.executedBy ?? null
    }

    // Single UPDATE … FROM unnest(...). For each column we keep the existing
    // value when the buffered patch passed null. Indexed by id (PK).
    const sql = `
      UPDATE ${this.tableName} AS s
      SET status        = v.status,
          output        = CASE WHEN v.output        IS NOT NULL THEN v.output        ELSE s.output        END,
          error         = CASE WHEN v.error         IS NOT NULL THEN v.error         ELSE s.error         END,
          "completedAt" = CASE WHEN v.completed_at  IS NOT NULL THEN v.completed_at  ELSE s."completedAt" END,
          "startedAt"   = CASE WHEN v.started_at    IS NOT NULL THEN v.started_at    ELSE s."startedAt"   END,
          "humanPrompt" = CASE WHEN v.human_prompt  IS NOT NULL THEN v.human_prompt  ELSE s."humanPrompt" END,
          "executedBy"  = CASE WHEN v.executed_by   IS NOT NULL THEN v.executed_by   ELSE s."executedBy"  END,
          "updatedAt"   = NOW()
      FROM (
        SELECT * FROM unnest(
          $1::text[], $2::text[], $3::text[], $4::text[],
          $5::timestamp[], $6::timestamp[], $7::text[], $8::text[]
        ) AS t(id, status, output, error, completed_at, started_at, human_prompt, executed_by)
      ) AS v
      WHERE s.id = v.id
    `

    const client = await this.pgPool.connect()
    try {
      // SET LOCAL synchronous_commit=off — same trade-off as the COPY path
      await client.query('BEGIN; SET LOCAL synchronous_commit = OFF;')
      await client.query(sql, [
        ids,
        statuses,
        outputs,
        errors,
        completedAts,
        startedAts,
        humanPrompts,
        executedBys,
      ])
      await client.query('COMMIT')
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {}
      throw err
    } finally {
      client.release()
    }
  }
}

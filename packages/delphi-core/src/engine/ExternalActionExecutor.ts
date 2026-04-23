// npx vitest run src/__tests__/engine/external-actions.spec.ts
//
// The consistency layer for ALL side effects that touch the real world.
//

import type { DbClient } from '../db/DbClient.js'
import { nanoId } from '../db/ids.js'
import type { ExternalAction } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'
import type { RateLimiterBackend } from './RateLimiterBackend.js'
import { InMemoryRateLimiter } from './RateLimiterBackend.js'

// ── Types ──────────────────────────────────────────────────────────

export interface ExternalActionRequest {
  workflowRunId: string
  stepName: string
  attempt: number
  tenantId: string
  provider: string
  actionType: string
  idempotencyKey?: string
  request: Record<string, unknown>
}

export interface ExternalActionResponse<T = Record<string, unknown>> {
  externalId: string
  data: T
}

export interface ExternalActionResult<T = Record<string, unknown>> {
  cached: boolean
  externalId: string
  data: T
  actionId: string
}

export type ExternalActionFn<T = Record<string, unknown>> = (
  request: Record<string, unknown>,
) => Promise<ExternalActionResponse<T>>

// ── Rate Limiter ───────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  maxConcurrentPerWorkflow?: number
}

// ── Helpers ───────────────────────────────────────────────────────

function hashPayload(payload: Record<string, unknown>): string {
  const { createHash } = require('node:crypto')
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .substring(0, 12)
}

// ── Executor ───────────────────────────────────────────────────────

export interface ExternalActionExecutorConfig {
  db: DbClient
  rateLimits?: Record<string, RateLimitConfig>
  maxConcurrentPerWorkflow?: number
  rateLimiterBackend?: RateLimiterBackend
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export class ExternalActionExecutor {
  private db: DbClient
  private rateLimits: Record<string, RateLimitConfig>
  private maxConcurrentPerWorkflow: number
  private logger: ExternalActionExecutorConfig['logger']
  private rateLimiter: RateLimiterBackend

  constructor(config: ExternalActionExecutorConfig) {
    this.db = config.db
    this.rateLimits = config.rateLimits ?? {}
    this.maxConcurrentPerWorkflow = config.maxConcurrentPerWorkflow ?? 5
    this.logger = config.logger
    this.rateLimiter = config.rateLimiterBackend ?? new InMemoryRateLimiter()
  }

  async execute<T = Record<string, unknown>>(
    req: ExternalActionRequest,
    fn: ExternalActionFn<T>,
  ): Promise<ExternalActionResult<T>> {
    const idempotencyKey =
      req.idempotencyKey ??
      `${req.workflowRunId}:${req.stepName}:${req.actionType}:${hashPayload(req.request)}`

    // ── Step 1: Check for existing completed action ──────
    const { rows: existingRows } = await this.db.query<ExternalAction>(
      `SELECT * FROM external_actions WHERE "idempotencyKey" = $1`,
      [idempotencyKey],
    )
    const existing = existingRows[0]

    if (existing?.status === 'completed' && existing.response) {
      this.logger?.debug?.(
        `[ExternalAction] Cache hit: ${req.provider}/${req.actionType} (key=${idempotencyKey})`,
      )
      return {
        cached: true,
        externalId: existing.externalId ?? '',
        data: fromJson(existing.response) as T,
        actionId: existing.id,
      }
    }

    // ── Step 1b: Crash recovery ──
    if (existing?.status === 'completing' && existing.externalId) {
      this.logger?.debug?.(
        `[ExternalAction] Crash recovery (completing): ${req.provider}/${req.actionType} (key=${idempotencyKey})`,
      )
      return {
        cached: true,
        externalId: existing.externalId,
        data: fromJson(existing.response) ?? ({} as T),
        actionId: existing.id,
      }
    }

    // ── Step 2: Failed action — delete so we can retry ────
    if (existing?.status === 'failed') {
      await this.db.query(`DELETE FROM external_actions WHERE id = $1`, [
        existing.id,
      ])
    }

    // ── Step 3: Concurrency protection ───────────────────
    if (existing?.status === 'pending') {
      const createdAt = new Date(existing.createdAt as string).getTime()
      const staleMs = 5 * 60 * 1000
      if (Date.now() - createdAt < staleMs) {
        throw new ExternalActionPendingError(
          idempotencyKey,
          req.provider,
          req.actionType,
        )
      }
      await this.db.query(`DELETE FROM external_actions WHERE id = $1`, [
        existing.id,
      ])
    }

    // ── Step 3: Rate limiting ────────────────────────────
    const providerLimit = this.rateLimits[req.provider]
    if (providerLimit) {
      await this.rateLimiter.checkRateLimit(
        req.provider,
        providerLimit.maxRequests,
        providerLimit.windowMs,
      )
    }
    await this.rateLimiter.checkConcurrency(
      req.workflowRunId,
      this.maxConcurrentPerWorkflow,
    )

    // ── Step 4: Insert pending action ────────────────────
    const actionId = nanoId(21)
    try {
      const { rows: runRows } = await this.db.query<{ traceId: string | null }>(
        `SELECT "traceId" FROM workflow_runs WHERE id = $1`,
        [req.workflowRunId],
      )

      await this.db.query(
        `INSERT INTO external_actions (id, "workflowRunId", "stepName", attempt, "tenantId", provider, "actionType", "idempotencyKey", status, request, "traceId", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          actionId,
          req.workflowRunId,
          req.stepName,
          req.attempt,
          req.tenantId,
          req.provider,
          req.actionType,
          idempotencyKey,
          'pending',
          toJson(req.request),
          runRows[0]?.traceId ?? null,
          new Date(),
        ],
      )
    } catch (err: any) {
      if (
        err.message?.includes('unique') ||
        err.message?.includes('duplicate') ||
        err.code === '23505'
      ) {
        const { rows: recheckRows } = await this.db.query<ExternalAction>(
          `SELECT * FROM external_actions WHERE "idempotencyKey" = $1`,
          [idempotencyKey],
        )
        const recheck = recheckRows[0]
        if (recheck?.status === 'completed' && recheck.response) {
          return {
            cached: true,
            externalId: recheck.externalId ?? '',
            data: fromJson(recheck.response) as T,
            actionId: recheck.id,
          }
        }
        throw new ExternalActionPendingError(
          idempotencyKey,
          req.provider,
          req.actionType,
        )
      }
      throw err
    }

    // ── Step 5: Execute ──────────────────────────────────
    await this.rateLimiter.incrementConcurrency(req.workflowRunId)

    try {
      this.logger?.info?.(
        `[ExternalAction] Executing: ${req.provider}/${req.actionType} (key=${idempotencyKey})`,
      )

      const result = await fn(req.request)

      // ── Step 6a: Persist externalId (crash consistency) ──
      await this.db.query(
        `UPDATE external_actions SET "externalId" = $1, status = $2 WHERE id = $3`,
        [result.externalId, 'completing', actionId],
      )

      // ── Step 6b: Store full response ───────────────────────
      await this.db.query(
        `UPDATE external_actions SET status = $1, response = $2, "completedAt" = $3 WHERE id = $4`,
        ['completed', toJson(result.data), new Date(), actionId],
      )

      await this.rateLimiter.recordRequest(req.provider)

      return {
        cached: false,
        externalId: result.externalId,
        data: result.data,
        actionId,
      }
    } catch (error: any) {
      await this.db.query(
        `UPDATE external_actions SET status = $1, error = $2, "completedAt" = $3 WHERE id = $4`,
        ['failed', error.message, new Date(), actionId],
      )

      this.logger?.error?.(
        `[ExternalAction] Failed: ${req.provider}/${req.actionType}: ${error.message}`,
      )
      throw error
    } finally {
      await this.rateLimiter.decrementConcurrency(req.workflowRunId)
    }
  }

  async getActionsForStep(
    workflowRunId: string,
    stepName: string,
  ): Promise<ExternalAction[]> {
    const { rows } = await this.db.query<ExternalAction>(
      `SELECT * FROM external_actions WHERE "workflowRunId" = $1 AND "stepName" = $2`,
      [workflowRunId, stepName],
    )
    return rows
  }

  async getActionsForWorkflow(
    workflowRunId: string,
  ): Promise<ExternalAction[]> {
    const { rows } = await this.db.query<ExternalAction>(
      `SELECT * FROM external_actions WHERE "workflowRunId" = $1 ORDER BY "createdAt" ASC`,
      [workflowRunId],
    )
    return rows
  }
}

// ── Errors ─────────────────────────────────────────────────────────

export class ExternalActionPendingError extends Error {
  readonly retryable = true
  constructor(
    public readonly idempotencyKey: string,
    public readonly provider: string,
    public readonly actionType: string,
  ) {
    super(
      `External action "${provider}/${actionType}" is already pending (key=${idempotencyKey}). Retry later.`,
    )
    this.name = 'ExternalActionPendingError'
  }
}

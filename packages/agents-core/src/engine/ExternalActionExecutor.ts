// npx vitest run src/__tests__/engine/external-actions.spec.ts
//
// The consistency layer for ALL side effects that touch the real world.
//
// Every external API call — create PR, create issue, send Slack message,
// deploy to production — MUST go through this. No bypass allowed.
//
// This guarantees:
//   1. Exactly-once execution (idempotency key dedup)
//   2. Safe retries (completed actions return cached response)
//   3. Concurrency protection (pending actions block duplicate execution)
//   4. Full audit trail (request + response + timing)
//
import { Ids } from '@goatlab/js-utils'
import type { Kysely } from 'kysely'
import type { Database, ExternalAction } from '../entities/Database.js'
import { fromJson, toJson } from '../entities/Database.js'

// ── Types ──────────────────────────────────────────────────────────

export interface ExternalActionRequest {
  /** Which workflow run this belongs to */
  workflowRunId: string
  /** Which step is executing this action */
  stepName: string
  /** Which attempt of the step */
  attempt: number
  /** Tenant ID */
  tenantId: string
  /** External service name: 'github', 'linear', 'slack', etc */
  provider: string
  /** Action type: 'create_pr', 'create_issue', 'comment', 'deploy', etc */
  actionType: string
  /**
   * Idempotency key — must be deterministic for the same logical action.
   * Default: `{workflowRunId}:{stepName}:{actionType}` but can be overridden
   * for multiple actions of the same type in one step.
   */
  idempotencyKey?: string
  /** The request payload (sent to external API) */
  request: Record<string, unknown>
}

export interface ExternalActionResponse<T = Record<string, unknown>> {
  /** The external ID (PR number, issue ID, etc) */
  externalId: string
  /** The full response from the external API */
  data: T
}

export interface ExternalActionResult<T = Record<string, unknown>> {
  /** Whether this was a new execution or a cached result from a previous attempt */
  cached: boolean
  /** The external ID */
  externalId: string
  /** The response data */
  data: T
  /** The action record ID */
  actionId: string
}

/**
 * The function that actually calls the external API.
 * Only called if no completed/pending action exists for this idempotency key.
 */
export type ExternalActionFn<T = Record<string, unknown>> = (
  request: Record<string, unknown>,
) => Promise<ExternalActionResponse<T>>

// ── Rate Limiter ───────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number
  /** Window size in ms */
  windowMs: number
  /** Max concurrent external calls per workflow run */
  maxConcurrentPerWorkflow?: number
}

// ── Executor ───────────────────────────────────────────────────────

export interface ExternalActionExecutorConfig {
  db: Kysely<Database>
  /** Rate limits per provider */
  rateLimits?: Record<string, RateLimitConfig>
  /** Max concurrent external calls per workflow (default: 5) */
  maxConcurrentPerWorkflow?: number
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

/**
 * ExternalActionExecutor — the gate between your workflows and the real world.
 *
 * Usage:
 * ```typescript
 * const result = await externalActions.execute(
 *   {
 *     workflowRunId, stepName, attempt, tenantId,
 *     provider: 'github',
 *     actionType: 'create_pr',
 *     request: { title: 'My PR', branch: 'feat/x' },
 *   },
 *   async (req) => {
 *     const pr = await github.createPR(req)
 *     return { externalId: pr.id, data: pr }
 *   },
 * )
 *
 * // On retry: returns cached result, does NOT create duplicate PR
 * ```
 */
export class ExternalActionExecutor {
  private db: Kysely<Database>
  private rateLimits: Record<string, RateLimitConfig>
  private maxConcurrentPerWorkflow: number
  private logger: ExternalActionExecutorConfig['logger']

  // In-memory rate limit tracking (per provider)
  private rateBuckets = new Map<string, { timestamps: number[] }>()
  // In-memory concurrency tracking (per workflow)
  private workflowConcurrency = new Map<string, number>()

  constructor(config: ExternalActionExecutorConfig) {
    this.db = config.db
    this.rateLimits = config.rateLimits ?? {}
    this.maxConcurrentPerWorkflow = config.maxConcurrentPerWorkflow ?? 5
    this.logger = config.logger
  }

  /**
   * Execute an external action with exactly-once guarantees.
   *
   * 1. Check if a completed action exists for this idempotency key → return cached
   * 2. Check if a pending action exists → throw RetryLater (concurrent execution protection)
   * 3. Check rate limits → wait if needed
   * 4. Insert pending action
   * 5. Execute the function
   * 6. Update to completed/failed
   * 7. Return result
   */
  async execute<T = Record<string, unknown>>(
    req: ExternalActionRequest,
    fn: ExternalActionFn<T>,
  ): Promise<ExternalActionResult<T>> {
    const idempotencyKey = req.idempotencyKey
      ?? `${req.workflowRunId}:${req.stepName}:${req.actionType}`

    // ── Step 1: Check for existing completed action ──────
    const existing = await this.db
      .selectFrom('external_actions')
      .selectAll()
      .where('idempotencyKey', '=', idempotencyKey)
      .executeTakeFirst()

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

    // ── Step 2: Concurrency protection ───────────────────
    if (existing?.status === 'pending') {
      // Another execution is in progress — check if it's stale (>5 min)
      const createdAt = new Date(existing.createdAt as string).getTime()
      const staleMs = 5 * 60 * 1000
      if (Date.now() - createdAt < staleMs) {
        throw new ExternalActionPendingError(idempotencyKey, req.provider, req.actionType)
      }
      // Stale pending — clean it up and re-execute
      await this.db
        .updateTable('external_actions')
        .set({ status: 'failed', error: 'Stale pending action cleaned up', completedAt: new Date() })
        .where('id', '=', existing.id)
        .execute()
    }

    // ── Step 3: Rate limiting ────────────────────────────
    await this.checkRateLimit(req.provider)
    await this.checkWorkflowConcurrency(req.workflowRunId)

    // ── Step 4: Insert pending action ────────────────────
    const actionId = Ids.nanoId(21)
    try {
      await this.db.insertInto('external_actions').values({
        id: actionId,
        workflowRunId: req.workflowRunId,
        stepName: req.stepName,
        attempt: req.attempt,
        tenantId: req.tenantId,
        provider: req.provider,
        actionType: req.actionType,
        idempotencyKey,
        status: 'pending',
        request: toJson(req.request),
        createdAt: new Date(),
      }).execute()
    } catch (err: any) {
      // Unique constraint violation = someone else inserted first
      if (err.message?.includes('unique') || err.message?.includes('duplicate') || err.code === '23505') {
        // Re-check — might be completed now
        const recheck = await this.db
          .selectFrom('external_actions')
          .selectAll()
          .where('idempotencyKey', '=', idempotencyKey)
          .executeTakeFirst()
        if (recheck?.status === 'completed' && recheck.response) {
          return {
            cached: true,
            externalId: recheck.externalId ?? '',
            data: fromJson(recheck.response) as T,
            actionId: recheck.id,
          }
        }
        throw new ExternalActionPendingError(idempotencyKey, req.provider, req.actionType)
      }
      throw err
    }

    // ── Step 5: Execute ──────────────────────────────────
    this.incrementConcurrency(req.workflowRunId)

    try {
      this.logger?.info?.(
        `[ExternalAction] Executing: ${req.provider}/${req.actionType} (key=${idempotencyKey})`,
      )

      const result = await fn(req.request)

      // ── Step 6: Mark completed ───────────────────────
      await this.db
        .updateTable('external_actions')
        .set({
          status: 'completed',
          externalId: result.externalId,
          response: toJson(result.data),
          completedAt: new Date(),
        })
        .where('id', '=', actionId)
        .execute()

      this.recordRateLimit(req.provider)

      return {
        cached: false,
        externalId: result.externalId,
        data: result.data,
        actionId,
      }
    } catch (error: any) {
      // ── Step 6b: Mark failed ─────────────────────────
      await this.db
        .updateTable('external_actions')
        .set({
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        })
        .where('id', '=', actionId)
        .execute()

      this.logger?.error?.(
        `[ExternalAction] Failed: ${req.provider}/${req.actionType}: ${error.message}`,
      )
      throw error
    } finally {
      this.decrementConcurrency(req.workflowRunId)
    }
  }

  /**
   * Get all external actions for a step execution.
   */
  async getActionsForStep(
    workflowRunId: string,
    stepName: string,
  ): Promise<ExternalAction[]> {
    return this.db
      .selectFrom('external_actions')
      .selectAll()
      .where('workflowRunId', '=', workflowRunId)
      .where('stepName', '=', stepName)
      .execute()
  }

  /**
   * Get all external actions for a workflow run.
   */
  async getActionsForWorkflow(workflowRunId: string): Promise<ExternalAction[]> {
    return this.db
      .selectFrom('external_actions')
      .selectAll()
      .where('workflowRunId', '=', workflowRunId)
      .orderBy('createdAt', 'asc')
      .execute()
  }

  // ── Rate Limiting (in-memory token bucket) ─────────────────────

  private async checkRateLimit(provider: string): Promise<void> {
    const config = this.rateLimits[provider]
    if (!config) return

    const bucket = this.rateBuckets.get(provider) ?? { timestamps: [] }
    this.rateBuckets.set(provider, bucket)

    // Remove timestamps outside the window
    const windowStart = Date.now() - config.windowMs
    bucket.timestamps = bucket.timestamps.filter(t => t >= windowStart)

    if (bucket.timestamps.length >= config.maxRequests) {
      // Wait until the oldest request falls out of the window
      const waitMs = bucket.timestamps[0] - windowStart + 100
      this.logger?.warn?.(
        `[RateLimit] ${provider}: limit reached (${config.maxRequests}/${config.windowMs}ms), waiting ${waitMs}ms`,
      )
      await new Promise(resolve => setTimeout(resolve, waitMs))
      // Re-check after waiting
      bucket.timestamps = bucket.timestamps.filter(t => t >= Date.now() - config.windowMs)
    }
  }

  private recordRateLimit(provider: string): void {
    const bucket = this.rateBuckets.get(provider)
    if (bucket) bucket.timestamps.push(Date.now())
  }

  // ── Per-Workflow Concurrency ───────────────────────────────────

  private async checkWorkflowConcurrency(workflowRunId: string): Promise<void> {
    const current = this.workflowConcurrency.get(workflowRunId) ?? 0
    if (current >= this.maxConcurrentPerWorkflow) {
      // Wait and retry
      this.logger?.warn?.(
        `[Concurrency] Workflow ${workflowRunId}: ${current}/${this.maxConcurrentPerWorkflow} concurrent, waiting`,
      )
      await new Promise(resolve => setTimeout(resolve, 500))
      return this.checkWorkflowConcurrency(workflowRunId)
    }
  }

  private incrementConcurrency(workflowRunId: string): void {
    const current = this.workflowConcurrency.get(workflowRunId) ?? 0
    this.workflowConcurrency.set(workflowRunId, current + 1)
  }

  private decrementConcurrency(workflowRunId: string): void {
    const current = this.workflowConcurrency.get(workflowRunId) ?? 1
    this.workflowConcurrency.set(workflowRunId, Math.max(0, current - 1))
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

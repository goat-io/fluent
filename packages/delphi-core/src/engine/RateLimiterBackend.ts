// npx vitest run src/__tests__/engine/rate-limiter.spec.ts
//
// Pluggable rate limiter backends for ExternalActionExecutor.
// InMemoryRateLimiter: single-process (default, resets on restart)
// RedisRateLimiter: multi-worker (survives restarts, shared across processes)
//

// ── Interface ─────────────────────────────────────────────────────

export interface RateLimiterBackend {
  /**
   * Check if a request is allowed under the rate limit.
   * If not, waits until it is. Returns when the request can proceed.
   */
  checkRateLimit(
    provider: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<void>

  /** Record that a request was made (for tracking). */
  recordRequest(provider: string): Promise<void>

  /** Check per-workflow concurrency. Waits if at limit. */
  checkConcurrency(workflowRunId: string, maxConcurrent: number): Promise<void>

  /** Increment active concurrent count for a workflow. */
  incrementConcurrency(workflowRunId: string): Promise<void>

  /** Decrement active concurrent count for a workflow. */
  decrementConcurrency(workflowRunId: string): Promise<void>
}

// ── In-Memory Implementation ──────────────────────────────────────

export class InMemoryRateLimiter implements RateLimiterBackend {
  private rateBuckets = new Map<string, { timestamps: number[] }>()
  private concurrency = new Map<string, number>()

  async checkRateLimit(
    provider: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<void> {
    const bucket = this.rateBuckets.get(provider) ?? { timestamps: [] }
    this.rateBuckets.set(provider, bucket)

    const windowStart = Date.now() - windowMs
    bucket.timestamps = bucket.timestamps.filter(t => t >= windowStart)

    if (bucket.timestamps.length >= maxRequests) {
      const waitMs = bucket.timestamps[0] - windowStart + 100
      await new Promise(resolve => setTimeout(resolve, waitMs))
      bucket.timestamps = bucket.timestamps.filter(
        t => t >= Date.now() - windowMs,
      )
    }
  }

  async recordRequest(provider: string): Promise<void> {
    const bucket = this.rateBuckets.get(provider)
    if (bucket) {
      bucket.timestamps.push(Date.now())
    }
  }

  async checkConcurrency(
    workflowRunId: string,
    maxConcurrent: number,
  ): Promise<void> {
    const current = this.concurrency.get(workflowRunId) ?? 0
    if (current >= maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return this.checkConcurrency(workflowRunId, maxConcurrent)
    }
  }

  async incrementConcurrency(workflowRunId: string): Promise<void> {
    const current = this.concurrency.get(workflowRunId) ?? 0
    this.concurrency.set(workflowRunId, current + 1)
  }

  async decrementConcurrency(workflowRunId: string): Promise<void> {
    const current = this.concurrency.get(workflowRunId) ?? 1
    this.concurrency.set(workflowRunId, Math.max(0, current - 1))
  }
}

// ── Redis Implementation ──────────────────────────────────────────

/**
 * Minimal Redis client interface — compatible with ioredis without hard dependency.
 */
export interface RedisClient {
  zadd(key: string, ...args: (string | number)[]): Promise<number | string>
  zremrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
  ): Promise<number>
  zcard(key: string): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  expire(key: string, seconds: number): Promise<number>
  incr(key: string): Promise<number>
  decr(key: string): Promise<number>
  get(key: string): Promise<string | null>
  /** Lua script execution — required for atomic rate limiting */
  eval(
    script: string,
    numkeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>
}

// ── Lua Scripts (atomic, single round-trip) ───────────────────────

/**
 * Atomic sliding window check + record.
 * KEYS[1] = rate limit key
 * ARGV[1] = windowMs, ARGV[2] = maxRequests, ARGV[3] = now, ARGV[4] = unique member, ARGV[5] = ttl
 * Returns: 0 = allowed, >0 = wait time in ms
 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local maxReqs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])
local windowStart = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local count = redis.call('ZCARD', key)

if count >= maxReqs then
  local oldest = redis.call('ZRANGE', key, 0, 0)
  if #oldest > 0 then
    local oldestScore = tonumber(redis.call('ZSCORE', key, oldest[1]))
    return oldestScore - windowStart + 100
  end
  return 100
end

return 0
`

/**
 * Atomic concurrency check + increment.
 * KEYS[1] = concurrency key
 * ARGV[1] = maxConcurrent, ARGV[2] = ttl
 * Returns: 0 = allowed (and incremented), 1 = at limit
 */
const _CONCURRENCY_CHECK_INCR_LUA = `
local key = KEYS[1]
local maxConc = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')

if current >= maxConc then
  return 1
end

redis.call('INCR', key)
redis.call('EXPIRE', key, ttl)
return 0
`

export class RedisRateLimiter implements RateLimiterBackend {
  private redis: RedisClient
  private prefix: string

  constructor(redis: RedisClient, prefix = 'agents:ratelimit') {
    this.redis = redis
    this.prefix = prefix
  }

  async checkRateLimit(
    provider: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<void> {
    const key = `${this.prefix}:provider:${provider}`
    const now = Date.now()
    const member = `${now}:${Math.random().toString(36).slice(2, 6)}`

    // Single atomic Lua call: clean window, check count, return wait time
    const waitMs = (await this.redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      windowMs,
      maxRequests,
      now,
      member,
      600,
    )) as number

    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs))
      // Re-check after waiting (clean again)
      await this.redis.zremrangebyscore(key, '-inf', Date.now() - windowMs)
    }
  }

  async recordRequest(provider: string): Promise<void> {
    const key = `${this.prefix}:provider:${provider}`
    const now = Date.now()
    await this.redis.zadd(
      key,
      now,
      `${now}:${Math.random().toString(36).slice(2, 6)}`,
    )
    await this.redis.expire(key, 600)
  }

  async checkConcurrency(
    workflowRunId: string,
    maxConcurrent: number,
  ): Promise<void> {
    const key = `${this.prefix}:concurrency:${workflowRunId}`

    const current = await this.redis.get(key)
    const count = current ? Number.parseInt(current, 10) : 0

    if (count >= maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return this.checkConcurrency(workflowRunId, maxConcurrent)
    }
  }

  async incrementConcurrency(workflowRunId: string): Promise<void> {
    const key = `${this.prefix}:concurrency:${workflowRunId}`
    await this.redis.incr(key)
    await this.redis.expire(key, 300)
  }

  async decrementConcurrency(workflowRunId: string): Promise<void> {
    const key = `${this.prefix}:concurrency:${workflowRunId}`
    await this.redis.decr(key)
  }
}

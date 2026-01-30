import type Redis from 'ioredis'

/**
 * Redis key prefix for all dispatch state.
 * Kept separate from tenant queue prefixes.
 */
const DISPATCH_PREFIX = 'dispatch'

/**
 * Atomic Lua scripts for dispatch state management.
 * All counter operations are atomic to prevent race conditions
 * between concurrent dispatch cycles.
 */
export class DispatchLuaScripts {
  constructor(private readonly redis: Redis) {}

  // --- Backlog Counter ---

  /**
   * Atomically increment the backlog counter and return the new value.
   * Called when a dispatch hint is written (enqueue side).
   */
  async incrementBacklog(delta = 1): Promise<number> {
    const result = await this.redis.eval(
      `local key = KEYS[1]
       local delta = tonumber(ARGV[1])
       local newValue = redis.call('INCRBY', key, delta)
       return newValue`,
      1,
      `${DISPATCH_PREFIX}:backlog`,
      delta,
    )
    return result as number
  }

  /**
   * Atomically decrement the backlog counter.
   * Called when a dispatch hint is processed (consumer side).
   * Never goes below 0.
   */
  async decrementBacklog(delta = 1): Promise<number> {
    const result = await this.redis.eval(
      `local key = KEYS[1]
       local delta = tonumber(ARGV[1])
       local current = tonumber(redis.call('GET', key) or '0')
       local newValue = math.max(0, current - delta)
       redis.call('SET', key, newValue)
       return newValue`,
      1,
      `${DISPATCH_PREFIX}:backlog`,
      delta,
    )
    return result as number
  }

  /**
   * Get the current backlog size.
   */
  async getBacklog(): Promise<number> {
    const value = await this.redis.get(`${DISPATCH_PREFIX}:backlog`)
    return value ? parseInt(value, 10) : 0
  }

  // --- Inflight Counter ---

  /**
   * Atomically increment the inflight dispatcher counter with TTL.
   * TTL acts as a safety net: if a dispatcher crashes without decrementing,
   * the counter auto-resets after 120s.
   */
  async incrementInflight(count = 1): Promise<number> {
    const result = await this.redis.eval(
      `local key = KEYS[1]
       local delta = tonumber(ARGV[1])
       local ttl = tonumber(ARGV[2])
       local newValue = redis.call('INCRBY', key, delta)
       redis.call('EXPIRE', key, ttl)
       return newValue`,
      1,
      `${DISPATCH_PREFIX}:inflight`,
      count,
      120, // 2 minute TTL as safety net
    )
    return result as number
  }

  /**
   * Decrement the inflight counter. Never goes below 0.
   */
  async decrementInflight(): Promise<number> {
    const result = await this.redis.eval(
      `local key = KEYS[1]
       local current = tonumber(redis.call('GET', key) or '0')
       local newValue = math.max(0, current - 1)
       redis.call('SET', key, newValue)
       if newValue > 0 then
         redis.call('EXPIRE', key, 120)
       end
       return newValue`,
      1,
      `${DISPATCH_PREFIX}:inflight`,
    )
    return result as number
  }

  /**
   * Get the current inflight count.
   */
  async getInflight(): Promise<number> {
    const value = await this.redis.get(`${DISPATCH_PREFIX}:inflight`)
    return value ? parseInt(value, 10) : 0
  }

  // --- Zero-Work Streak (Circuit Breaker) ---

  /**
   * Increment the zero-work streak counter and return the NEW value.
   * Called when a dispatch cycle processes 0 jobs.
   */
  async incrementZeroWorkStreak(): Promise<number> {
    const result = await this.redis.eval(
      `local key = KEYS[1]
       local newValue = redis.call('INCR', key)
       redis.call('EXPIRE', key, 300)
       return newValue`,
      1,
      `${DISPATCH_PREFIX}:zero-work-streak`,
    )
    return result as number
  }

  /**
   * Reset the zero-work streak counter to 0.
   * Called when a dispatch cycle processes at least 1 job.
   */
  async resetZeroWorkStreak(): Promise<void> {
    await this.redis.del(`${DISPATCH_PREFIX}:zero-work-streak`)
  }

  /**
   * Get the current zero-work streak count.
   */
  async getZeroWorkStreak(): Promise<number> {
    const value = await this.redis.get(`${DISPATCH_PREFIX}:zero-work-streak`)
    return value ? parseInt(value, 10) : 0
  }
}

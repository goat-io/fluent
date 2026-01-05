// npx vitest run ./src/services/search/typesense/tests/resilience-policy.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResiliencePolicy } from '../components/resilience-policy'

describe('ResiliencePolicy', () => {
  let policy: ResiliencePolicy

  beforeEach(() => {
    policy = new ResiliencePolicy({
      maxFailures: 3,
      resetTimeout: 1000,
      retryDelay: 100,
      maxRetries: 2,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after max failures', () => {
      expect(policy.isCircuitOpen()).toBe(false)

      // Record failures
      policy.recordFailure()
      policy.recordFailure()
      expect(policy.isCircuitOpen()).toBe(false)

      policy.recordFailure() // This should open the circuit
      expect(policy.isCircuitOpen()).toBe(true)
    })

    it('should reset circuit after timeout', () => {
      // Open the circuit
      policy.recordFailure()
      policy.recordFailure()
      policy.recordFailure()
      expect(policy.isCircuitOpen()).toBe(true)

      // Advance time
      vi.advanceTimersByTime(1000)
      expect(policy.isCircuitOpen()).toBe(false)
    })

    it('should reset failures on success', () => {
      policy.recordFailure()
      policy.recordFailure()
      policy.recordSuccess()

      expect(policy.getStatus().failures).toBe(0)
      expect(policy.isCircuitOpen()).toBe(false)
    })
  })

  describe('Retry Logic', () => {
    it('should allow retries within max limit', () => {
      const error = { status: 500 }

      expect(policy.shouldRetry(0, error)).toBe(true)
      expect(policy.shouldRetry(1, error)).toBe(true)
      expect(policy.shouldRetry(2, error)).toBe(false) // Exceeds max retries
    })

    it('should not retry when circuit is open', () => {
      // Open circuit
      policy.recordFailure()
      policy.recordFailure()
      policy.recordFailure()

      const error = { status: 500 }
      expect(policy.shouldRetry(0, error)).toBe(false)
    })

    it('should not retry 4xx errors except 429', () => {
      expect(policy.shouldRetry(0, { status: 400 })).toBe(false)
      expect(policy.shouldRetry(0, { status: 404 })).toBe(false)
      expect(policy.shouldRetry(0, { status: 429 })).toBe(true)
      expect(policy.shouldRetry(0, { status: 500 })).toBe(true)
    })

    it('should calculate exponential backoff with jitter', () => {
      const delay1 = policy.getRetryDelay(0)
      const delay2 = policy.getRetryDelay(1)
      const delay3 = policy.getRetryDelay(2)

      expect(delay2).toBeGreaterThan(delay1)
      expect(delay3).toBeGreaterThan(delay2)

      // Should have some jitter (not exact multiples)
      expect(delay2).not.toBe(delay1 * 2)
    })
  })

  describe('Rate Limiting', () => {
    it('should parse rate limit headers correctly', () => {
      const headers = new Headers({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-ResetMs': String(Date.now() + 60000),
        'Retry-After': '30',
      })

      policy.updateRateLimit(headers)
      const rateLimit = policy.getRateLimit()

      expect(rateLimit?.limit).toBe(100)
      expect(rateLimit?.remaining).toBe(10)
      expect(rateLimit?.retryAfter).toBe(30)
    })

    it('should respect retry-after period', () => {
      const headers = new Headers({
        'Retry-After': '5',
      })

      policy.updateRateLimit(headers)
      expect(policy.shouldRetry(0, { status: 429 })).toBe(false)

      // Advance time past retry-after
      vi.advanceTimersByTime(6000)
      expect(policy.shouldRetry(0, { status: 429 })).toBe(true)
    })

    it('should detect rate limited state', () => {
      expect(policy.isRateLimited()).toBe(false)

      const headers = new Headers({
        'X-RateLimit-Remaining': '0',
      })

      policy.updateRateLimit(headers)
      expect(policy.isRateLimited()).toBe(true)
    })

    it('should calculate time until reset', () => {
      const resetTime = Date.now() + 30000
      const headers = new Headers({
        'X-RateLimit-ResetMs': String(resetTime),
      })

      policy.updateRateLimit(headers)
      const timeUntilReset = policy.getTimeUntilReset()

      expect(timeUntilReset).toBeGreaterThan(25000)
      expect(timeUntilReset).toBeLessThanOrEqual(30000)
    })
  })

  describe('Status Reporting', () => {
    it('should provide comprehensive status', () => {
      policy.recordFailure()
      policy.recordFailure()

      const headers = new Headers({
        'X-RateLimit-Remaining': '5',
      })
      policy.updateRateLimit(headers)

      const status = policy.getStatus()

      expect(status.failures).toBe(2)
      expect(status.circuitOpen).toBe(false)
      expect(status.rateLimited).toBe(false)
      expect(status.rateLimit?.remaining).toBe(5)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all state', () => {
      // Set up some state
      policy.recordFailure()
      policy.recordFailure()
      policy.recordFailure() // Open circuit

      const headers = new Headers({
        'Retry-After': '30',
      })
      policy.updateRateLimit(headers)

      expect(policy.isCircuitOpen()).toBe(true)
      expect(policy.isRateLimited()).toBe(true)

      // Reset
      policy.reset()

      expect(policy.isCircuitOpen()).toBe(false)
      expect(policy.isRateLimited()).toBe(false)
      expect(policy.getStatus().failures).toBe(0)
    })
  })
})

// npx vitest run src/__tests__/utils/circuit-breaker.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'

describe('CircuitBreaker', () => {
  describe('state transitions', () => {
    it('starts in CLOSED state', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
      })
      expect(cb.getState()).toBe('CLOSED')
    })

    it('transitions CLOSED → OPEN after threshold failures', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 60000,
      })

      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('fail')
          })
        } catch {}
      }

      expect(cb.getState()).toBe('OPEN')
    })

    it('rejects calls immediately when OPEN', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 60000,
      })
      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}

      const mockFn = vi.fn()
      await expect(cb.execute(mockFn)).rejects.toThrow(
        'Circuit breaker is OPEN',
      )
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('transitions OPEN → HALF_OPEN after reset timeout', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 5000,
      })

      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}
      expect(cb.getState()).toBe('OPEN')

      vi.advanceTimersByTime(5001)
      expect(cb.getState()).toBe('HALF_OPEN')

      vi.useRealTimers()
    })

    it('transitions HALF_OPEN → CLOSED after successful retries', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
        halfOpenRetries: 2,
      })

      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}
      vi.advanceTimersByTime(1001)

      await cb.execute(async () => 'ok')
      await cb.execute(async () => 'ok')
      expect(cb.getState()).toBe('CLOSED')

      vi.useRealTimers()
    })

    it('transitions HALF_OPEN → OPEN on failure', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      })

      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}
      vi.advanceTimersByTime(1001)

      // First call succeeds (HALF_OPEN)
      await cb.execute(async () => 'ok')
      expect(cb.getState()).toBe('HALF_OPEN')

      // Failure goes back to OPEN
      try {
        await cb.execute(async () => {
          throw new Error('fail again')
        })
      } catch {}
      expect(cb.getState()).toBe('OPEN')

      vi.useRealTimers()
    })
  })

  describe('error classification', () => {
    it('respects shouldTrip filter', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        shouldTrip: err => err.status >= 500,
      })

      // 400 errors should NOT trip
      for (let i = 0; i < 5; i++) {
        try {
          await cb.execute(async () => {
            throw { status: 400, message: 'bad request' }
          })
        } catch {}
      }
      expect(cb.getState()).toBe('CLOSED')

      // 500 errors SHOULD trip
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw { status: 500, message: 'server error' }
          })
        } catch {}
      }
      expect(cb.getState()).toBe('OPEN')
    })
  })

  describe('failure window', () => {
    it('resets failures after window expires', async () => {
      vi.useFakeTimers()
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 60000,
        windowSizeMs: 5000,
      })

      // 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('fail')
          })
        } catch {}
      }
      expect(cb.getState()).toBe('CLOSED')

      // Wait for window to expire
      vi.advanceTimersByTime(5001)

      // 2 more failures (old ones expired, so still under threshold)
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('fail')
          })
        } catch {}
      }
      expect(cb.getState()).toBe('CLOSED')

      // One more should trip it
      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}
      expect(cb.getState()).toBe('OPEN')

      vi.useRealTimers()
    })
  })

  describe('metrics', () => {
    it('tracks call counts', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 10,
        resetTimeoutMs: 1000,
      })

      await cb.execute(async () => 'ok')
      await cb.execute(async () => 'ok')
      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}

      const metrics = cb.getMetrics()
      expect(metrics.totalCalls).toBe(3)
      expect(metrics.successfulCalls).toBe(2)
      expect(metrics.failedCalls).toBe(1)
      expect(metrics.state).toBe('CLOSED')
    })
  })

  describe('reset', () => {
    it('resets all state', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 60000,
      })
      try {
        await cb.execute(async () => {
          throw new Error('fail')
        })
      } catch {}
      expect(cb.getState()).toBe('OPEN')

      cb.reset()
      expect(cb.getState()).toBe('CLOSED')
      expect(cb.getMetrics().totalCalls).toBe(0)
    })
  })
})

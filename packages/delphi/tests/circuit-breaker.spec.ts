// npx vitest run tests/circuit-breaker.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CircuitBreaker } from '../src/utils/circuit-breaker'

describe('Circuit Breaker Recovery', () => {
  let circuitBreaker: CircuitBreaker
  let mockService: any
  
  beforeEach(() => {
    vi.useFakeTimers()
    
    // Create a mock service that we can control
    mockService = vi.fn()
    
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 60 seconds
      halfOpenRetries: 3,
      windowSizeMs: 10000 // 10 second window
    })
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should transition from CLOSED to OPEN after 5 failures', async () => {
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // Simulate 5 failures
    for (let i = 0; i < 5; i++) {
      mockService.mockRejectedValueOnce(new Error('Service error'))
      
      try {
        await circuitBreaker.execute(async () => {
          return await mockService()
        })
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Circuit should now be OPEN
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Further calls should fail immediately without calling the service
    mockService.mockClear()
    
    await expect(
      circuitBreaker.execute(async () => mockService())
    ).rejects.toThrow('Circuit breaker is OPEN')
    
    expect(mockService).not.toHaveBeenCalled()
  })

  it('should transition from OPEN to HALF_OPEN after timeout', async () => {
    // Force circuit to OPEN state
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Service down')
        })
      } catch {
        // Expected
      }
    }
    
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Fast-forward time to just before reset timeout
    vi.advanceTimersByTime(59999)
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Fast-forward past reset timeout
    vi.advanceTimersByTime(1)
    
    // Next call should attempt in HALF_OPEN state
    mockService.mockResolvedValueOnce('Success!')
    
    const result = await circuitBreaker.execute(async () => mockService())
    
    expect(result).toBe('Success!')
    expect(circuitBreaker.getState()).toBe('HALF_OPEN')
  })

  it('should transition from HALF_OPEN to CLOSED after successful calls', async () => {
    // Force circuit to OPEN state
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Service down')
        })
      } catch {
        // Expected
      }
    }
    
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Wait for reset timeout
    vi.advanceTimersByTime(60000)
    
    // Make 3 successful calls in HALF_OPEN state
    for (let i = 0; i < 3; i++) {
      mockService.mockResolvedValueOnce(`Success ${i}`)
      await circuitBreaker.execute(async () => mockService())
    }
    
    // Circuit should now be CLOSED
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // Further calls should work normally
    mockService.mockResolvedValueOnce('Normal operation')
    const result = await circuitBreaker.execute(async () => mockService())
    expect(result).toBe('Normal operation')
  })

  it('should transition from HALF_OPEN back to OPEN on failure', async () => {
    // Force circuit to OPEN state
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Service down')
        })
      } catch {
        // Expected
      }
    }
    
    expect(circuitBreaker.getState()).toBe('OPEN')
    
    // Wait for reset timeout
    vi.advanceTimersByTime(60000)
    
    // First call in HALF_OPEN succeeds
    mockService.mockResolvedValueOnce('Success')
    await circuitBreaker.execute(async () => mockService())
    expect(circuitBreaker.getState()).toBe('HALF_OPEN')
    
    // Second call fails
    mockService.mockRejectedValueOnce(new Error('Service down again'))
    
    try {
      await circuitBreaker.execute(async () => mockService())
    } catch {
      // Expected
    }
    
    // Should be back to OPEN
    expect(circuitBreaker.getState()).toBe('OPEN')
  })

  it('should handle concurrent requests correctly', async () => {
    const results: Array<{ success: boolean; error?: any }> = []
    
    // Force circuit to OPEN
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Service down')
        })
      } catch {
        // Expected
      }
    }
    
    // Try 10 concurrent requests while circuit is OPEN
    const promises = Array(10).fill(0).map(async () => {
      try {
        const result = await circuitBreaker.execute(async () => mockService())
        return { success: true, result }
      } catch (error) {
        return { success: false, error }
      }
    })
    
    const concurrentResults = await Promise.all(promises)
    
    // All should fail immediately
    expect(concurrentResults.every(r => !r.success)).toBe(true)
    expect(mockService).not.toHaveBeenCalled()
  })

  it('should track metrics correctly', async () => {
    const metrics = circuitBreaker.getMetrics()
    
    expect(metrics.totalCalls).toBe(0)
    expect(metrics.successfulCalls).toBe(0)
    expect(metrics.failedCalls).toBe(0)
    
    // Make some successful calls
    for (let i = 0; i < 3; i++) {
      mockService.mockResolvedValueOnce('Success')
      await circuitBreaker.execute(async () => mockService())
    }
    
    // Make some failed calls
    for (let i = 0; i < 2; i++) {
      mockService.mockRejectedValueOnce(new Error('Failure'))
      try {
        await circuitBreaker.execute(async () => mockService())
      } catch {
        // Expected
      }
    }
    
    const updatedMetrics = circuitBreaker.getMetrics()
    expect(updatedMetrics.totalCalls).toBe(5)
    expect(updatedMetrics.successfulCalls).toBe(3)
    expect(updatedMetrics.failedCalls).toBe(2)
    expect(updatedMetrics.state).toBe('CLOSED')
  })

  it('should handle different error types appropriately', async () => {
    // Some errors should trip the circuit
    const criticalErrors = [
      new Error('ECONNREFUSED'),
      new Error('ETIMEDOUT'),
      new Error('Service Unavailable'),
      { status: 503 },
      { status: 500 }
    ]
    
    // Some errors should not trip the circuit
    const nonCriticalErrors = [
      new Error('Invalid input'),
      new Error('Unauthorized'),
      { status: 400 },
      { status: 401 },
      { status: 404 }
    ]
    
    // Test critical errors
    for (const error of criticalErrors) {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        shouldTrip: (err) => {
          if (err.status) return err.status >= 500
          return err.message.includes('ECONNREFUSED') || 
                 err.message.includes('ETIMEDOUT') ||
                 err.message.includes('Unavailable')
        }
      })
      
      // These should trip the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw error
          })
        } catch {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('OPEN')
    }
    
    // Test non-critical errors
    for (const error of nonCriticalErrors) {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        shouldTrip: (err) => {
          if (err.status) return err.status >= 500
          return false
        }
      })
      
      // These should NOT trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw error
          })
        } catch {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('CLOSED')
    }
  })

  it('should reset failure count after window expires', async () => {
    // Configure with 5 second window
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 60000,
      windowSizeMs: 5000
    })
    
    // Make 2 failures
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Failure')
        })
      } catch {
        // Expected
      }
    }
    
    // Still CLOSED (threshold is 3)
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // Wait for window to expire
    vi.advanceTimersByTime(5001)
    
    // Make 2 more failures
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Failure')
        })
      } catch {
        // Expected
      }
    }
    
    // Should still be CLOSED because old failures expired
    expect(circuitBreaker.getState()).toBe('CLOSED')
    
    // One more failure should trip it
    try {
      await circuitBreaker.execute(async () => {
        throw new Error('Failure')
      })
    } catch {
      // Expected
    }
    
    expect(circuitBreaker.getState()).toBe('OPEN')
  })
})
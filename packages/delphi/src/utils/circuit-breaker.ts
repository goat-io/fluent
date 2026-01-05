/**
 * Circuit Breaker implementation for fault tolerance
 */

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenRetries?: number
  windowSizeMs?: number
  shouldTrip?: (error: any) => boolean
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failures: number[] = []
  private successCount = 0
  private totalCalls = 0
  private successfulCalls = 0
  private failedCalls = 0
  private lastFailureTime = 0
  private config: Required<CircuitBreakerConfig>

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs,
      halfOpenRetries: config.halfOpenRetries || 3,
      windowSizeMs: config.windowSizeMs || 10000,
      shouldTrip: config.shouldTrip || (() => true),
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      const now = Date.now()
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN'
        this.successCount = 0
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  private onSuccess() {
    this.successfulCalls++

    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.config.halfOpenRetries) {
        this.state = 'CLOSED'
        this.failures = []
      }
    }
  }

  private onFailure(error: any) {
    this.failedCalls++

    if (!this.config.shouldTrip(error)) {
      return
    }

    const now = Date.now()
    this.lastFailureTime = now

    // Add failure to window
    this.failures.push(now)

    // Remove old failures outside window
    const windowStart = now - this.config.windowSizeMs
    this.failures = this.failures.filter(t => t > windowStart)

    // Check if we should trip the circuit
    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'OPEN'
    } else if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN goes back to OPEN
      this.state = 'OPEN'
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    // Check if we should auto-transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      const now = Date.now()
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        return 'HALF_OPEN'
      }
    }
    return this.state
  }

  getMetrics() {
    return {
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      state: this.getState(),
      failuresInWindow: this.failures.length,
    }
  }

  reset() {
    this.state = 'CLOSED'
    this.failures = []
    this.successCount = 0
    this.lastFailureTime = 0
  }
}

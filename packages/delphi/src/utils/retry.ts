/**
 * Retry utility with exponential backoff and circuit breaker pattern
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: any) => boolean
}

export interface CircuitBreakerOptions {
  failureThreshold?: number
  resetTimeoutMs?: number
  halfOpenRetries?: number
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private lastFailureTime = 0
  private halfOpenAttempts = 0

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRetries: 3,
      ...options
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.options.resetTimeoutMs!) {
        throw new Error('Circuit breaker is OPEN')
      }
      this.state = CircuitState.HALF_OPEN
      this.halfOpenAttempts = 0
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++
      if (this.halfOpenAttempts >= this.options.halfOpenRetries!) {
        this.state = CircuitState.CLOSED
        this.failureCount = 0
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
    } else if (this.failureCount >= this.options.failureThreshold!) {
      this.state = CircuitState.OPEN
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getMetrics() {
    return {
      totalCalls: 0, // Not tracked in simple implementation
      successfulCalls: 0,
      failedCalls: this.failureCount,
      state: this.state
    }
  }

  reset() {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.halfOpenAttempts = 0
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options

  let lastError: any
  let delayMs = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }

      console.log(
        `⚠️ Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`
      )

      await sleep(delayMs)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs)
    }
  }

  throw lastError
}

export class RetryableClient {
  private circuitBreaker: CircuitBreaker

  constructor(
    _baseClient: any,
    private retryOptions: RetryOptions = {},
    circuitBreakerOptions: CircuitBreakerOptions = {}
  ) {
    // baseClient not used directly - accessed via execute()
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions)
  }

  async request<T>(requestFn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(() =>
      retryWithBackoff(requestFn, this.retryOptions)
    )
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState()
  }

  resetCircuit() {
    this.circuitBreaker.reset()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isRetryableError(error: any): boolean {
  if (!error) {
    return false
  }

  const retryableStatusCodes = [408, 429, 500, 502, 503, 504]
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true
  }

  const retryableMessages = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EPIPE'
  ]
  const errorMessage = error.message || error.toString()
  return retryableMessages.some(msg => errorMessage.includes(msg))
}

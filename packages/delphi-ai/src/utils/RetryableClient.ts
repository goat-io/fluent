// npx vitest run src/__tests__/utils/circuit-breaker.spec.ts

export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs?: number
  shouldRetry?: (error: any) => boolean
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs = 30_000 } = config
  const shouldRetry = config.shouldRetry ?? (() => true)

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error
      }

      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export function isRetryableError(error: any): boolean {
  if (error?.status === 429) {
    return true // Rate limit
  }
  if (error?.status >= 500) {
    return true // Server error
  }
  if (error?.code === 'ECONNREFUSED') {
    return true
  }
  if (error?.code === 'ETIMEDOUT') {
    return true
  }
  if (error?.code === 'ENOTFOUND') {
    return true
  }
  return false
}

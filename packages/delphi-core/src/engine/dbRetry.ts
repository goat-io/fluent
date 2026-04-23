// npx vitest run src/__tests__/engine/dbos-parity.spec.ts
//
// Connection-resilient retry wrapper for database operations.
// Inspired by DBOS's @dbRetry — exponential backoff with jitter
// on transient PostgreSQL and Node.js network errors.

/** PostgreSQL SQLSTATE classes that indicate transient connection issues */
const PG_RETRYABLE_CLASSES = new Set([
  '08', // Connection Exception
  '53', // Insufficient Resources
  '57', // Operator Intervention
])

/** Specific SQLSTATE codes that are retryable */
const PG_RETRYABLE_CODES = new Set([
  '40003', // Statement Completion Unknown
])

/** Node.js / network error codes that are retryable */
const NODE_RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EPIPE',
])

export interface DbRetryOptions {
  /** Max number of retries (default: 5) */
  maxRetries?: number
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number
  /** Max delay in ms (default: 60000) */
  maxDelayMs?: number
  /** Backoff multiplier (default: 2) */
  backoffRate?: number
  /** Logger (optional) */
  logger?: { warn: (...args: unknown[]) => void }
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false
  }

  const e = err as any

  // Check PostgreSQL SQLSTATE code
  if (typeof e.code === 'string') {
    // Check full code
    if (PG_RETRYABLE_CODES.has(e.code)) {
      return true
    }
    // Check SQLSTATE class (first 2 chars)
    if (e.code.length === 5 && PG_RETRYABLE_CLASSES.has(e.code.slice(0, 2))) {
      return true
    }
    // Check Node.js error codes
    if (NODE_RETRYABLE_CODES.has(e.code)) {
      return true
    }
  }

  // Check error message for connection-related keywords
  const msg = e.message?.toLowerCase() ?? ''
  if (
    msg.includes('connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('connection reset') ||
    msg.includes('client has encountered a connection error')
  ) {
    return true
  }

  return false
}

/**
 * Execute an async function with exponential backoff retry on transient DB errors.
 *
 * Only retries on connection/resource errors — NOT on logic errors (syntax, constraint violations, etc).
 * "If DBOS loses its database connection, everything pauses until the connection is recovered,
 * trading off availability for correctness."
 */
export async function dbRetry<T>(
  fn: () => Promise<T>,
  opts?: DbRetryOptions,
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 5
  const initialDelayMs = opts?.initialDelayMs ?? 1000
  const maxDelayMs = opts?.maxDelayMs ?? 60000
  const backoffRate = opts?.backoffRate ?? 2

  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryableError(err) || attempt >= maxRetries) {
        throw err
      }
      lastError = err as Error

      // Exponential backoff with jitter
      const baseDelay = Math.min(
        initialDelayMs * backoffRate ** attempt,
        maxDelayMs,
      )
      const jitter = baseDelay * 0.5 * Math.random()
      const delay = baseDelay + jitter

      opts?.logger?.warn(
        `[dbRetry] Attempt ${attempt + 1}/${maxRetries} failed (${(err as any).code ?? 'unknown'}), retrying in ${Math.round(delay)}ms`,
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

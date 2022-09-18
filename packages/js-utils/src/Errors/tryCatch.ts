import { CommonLogger, Errors, Strings } from '../index'
import type { AnyFunction } from '../types'
import { Time } from '../Time'

export interface TryCatchOptions {
  /**
   * The value returned from the function will be returned from the wrapped method (!).
   * onError function may be asynchronous.
   */
  onError?: (err: Error) => any

  /**
   * @default false
   */
  logSuccess?: boolean

  /**
   * @default true
   */
  logError?: boolean

  /**
   * Default to `console`
   */
  logger?: CommonLogger
}

/**
 * Decorates a function with "try/catch", so it'll never reject/throw.
 * Only applies to async functions (or, turns sync function into async).
 *
 * Allows to pass onError callback.
 *
 * @experimental
 */
export function tryCatch<T extends AnyFunction>(
  fn: T,
  opt: TryCatchOptions = {}
): T {
  const { onError, logError = true, logSuccess = false, logger = console } = opt

  const fname = fn.name || 'anonymous'

  return async function (this: any, ...args: any[]) {
    const started = Date.now()

    try {
      const r = await fn.apply(this, args)

      if (logSuccess) {
        logger.log(`tryCatch.${fname} succeeded in ${Time.since(started)}`)
      }

      return r
    } catch (err) {
      if (logError) {
        logger.warn(
          `tryCatch.${fname} error in ${Time.since(
            started
          )}:\n${Strings.stringifyAny(err, {
            includeErrorData: true
          })}`
        )
      }

      if (onError) {
        try {
          return await onError(Errors.anyToError(err)) // eslint-disable-line @typescript-eslint/return-await
        } catch {}
      }
      // returns undefined, but doesn't rethrow
    }
  } as any
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TryCatch =
  (opt: TryCatchOptions = {}): MethodDecorator =>
  (target, key, descriptor) => {
    const originalFn = descriptor.value
    descriptor.value = tryCatch(originalFn as any, opt)
    return descriptor
  }

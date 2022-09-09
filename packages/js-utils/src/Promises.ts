import { pRetry, pRetryFn } from 'Promises/pRetry'
import { pMap } from './Promises/pMap'
/**
 * Wraps async calls in try catch blocks
 * to simplify syntax.
 *
 * source: https://github.com/scopsy/await-to-js/blob/master/src/await-to-js.ts
 */
class PromisesClass {
  async try<ERR = Error, RETURN = void>(
    promise: Promise<RETURN>
  ): Promise<[err: ERR | null, value: Awaited<RETURN>]> {
    try {
      return [null, await promise]
    } catch (err) {
      return [err as ERR, undefined as any]
    }
  }

  /**
   * Promise.all for Object instead of Array.
   * Reference: https://github.com/NaturalCycles/js-lib/blob/master/src/promise/pProps.ts
   * @param input
   * @returns
   */
  async props<T>(input: { [K in keyof T]: T[K] | Promise<T[K]> }): Promise<{
    [K in keyof T]: Awaited<T[K]>
  }> {
    const keys = Object.keys(input)
    return Object.fromEntries(
      (await Promise.all(Object.values(input))).map((v, i) => [keys[i], v])
    ) as any
  }

  map = pMap

  retry = pRetry

  retryFunction = pRetryFn
}

export const Promises = new PromisesClass()
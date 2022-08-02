/**
 * Wraps async calls in try catch blocks
 * to simplify syntax.
 *
 * source: https://github.com/scopsy/await-to-js/blob/master/src/await-to-js.ts
 */

class PromisesClass {

  async try<ERR = Error, RETURN = void>(
    promise: Promise<RETURN>,
  ): Promise<[err: ERR | null, value: Awaited<RETURN>]> {
    try {
      return [null, await promise]
    } catch (err) {
      return [err as ERR, undefined as any]
    }
  }

}

export const Promises = new PromisesClass()
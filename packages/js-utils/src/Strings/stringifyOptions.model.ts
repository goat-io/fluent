import type { Reviver } from '../types'

export type JsonStringifyFunction = (
  obj: any,
  reviver?: Reviver,
  space?: number
) => string

export interface StringifyAnyOptions {
  /**
   * @default 10_000
   * Default limit is less than in Node, cause it's likely to be used e.g in Browser alert()
   */
  maxLen?: number

  /**
   * Pass true to include "stringified" `error.data` in the output.
   *
   * @default false
   */
  includeErrorData?: boolean

  /**
   * Set to true to print Error.stack instead of just Error.message.
   *
   * @default false
   */
  includeErrorStack?: boolean

  /**
   * Allows to pass custom "stringify function".
   * E.g in Node.js you can pass `util.inspect` instead.
   *
   * @default JSON.stringify
   */
  stringifyFn?: JsonStringifyFunction
}

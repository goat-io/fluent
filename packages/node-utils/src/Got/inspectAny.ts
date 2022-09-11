import { inspect, InspectOptions } from 'util'
import { Strings } from '@goatlab/js-utils'
import type {
  StringifyAnyOptions,
  JsonStringifyFunction
} from '@goatlab/js-utils'

export interface InspectAnyOptions
  extends StringifyAnyOptions,
    InspectOptions {}

const INSPECT_OPT: InspectOptions = {
  breakLength: 80, // default: ??
  depth: 10 // default: 2
}

/**
 * Just a convenience export of a const that fulfills the JsonStringifyFunction interface.
 */
export const inspectAnyStringifyFn: JsonStringifyFunction = obj =>
  inspectAny(obj)

/**
 * Transforms ANY to human-readable string (via util.inspect mainly).
 * Safe (no error throwing).
 *
 * Correclty prints Errors, AppErrors, ErrorObjects: error.message + \n + inspect(error.data)
 *
 * Enforces max length (default to 10_000, pass 0 to skip it).
 *
 * Logs numbers as-is, e.g: `6`.
 * Logs strings as-is (without single quotes around, unlike default util.inspect behavior).
 * Otherwise - just uses util.inspect() with reasonable defaults.
 *
 * Returns 'empty_string' if empty string is passed.
 * Returns 'undefined' if undefined is passed (default util.inspect behavior).
 *
 * Based on `_stringifyAny` from `js-lib`, just replaced `JSON.stringify` with `util.inspect`.
 */
export function inspectAny(obj: any, opt: InspectAnyOptions = {}): string {
  // Inspect handles functions better
  if (typeof obj === 'function') {
    return inspect(obj, {
      ...INSPECT_OPT,
      ...opt
    })
  }

  return Strings.stringifyAny(obj, {
    ...opt,
    stringifyFn: obj =>
      inspect(obj, {
        ...INSPECT_OPT,
        ...opt
      })
  })
}

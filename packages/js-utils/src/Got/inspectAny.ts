import { inspect, InspectOptions } from 'util'
import { Strings } from '../Strings'
import type { StringifyAnyOptions, JsonStringifyFunction } from '../index'

export interface InspectAnyOptions
  extends StringifyAnyOptions,
    InspectOptions {}

const INSPECT_OPT: InspectOptions = {
  breakLength: 80,
  depth: 10
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

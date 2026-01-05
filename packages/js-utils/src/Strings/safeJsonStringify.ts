import type { Reviver } from '../types'

/**
 * JSON.stringify that avoids circular references, prints them as [Circular ~]
 *
 * Based on: https://github.com/moll/json-stringify-safe/
 */
export function safeJsonStringify(
  obj: any,
  replacer?: Reviver,
  spaces?: number,
  cycleReplacer?: Reviver,
): string {
  try {
    // Try native first (as it's ~3 times faster)
    return JSON.stringify(obj, replacer, spaces)
  } catch {
    // Native failed - resort to the "safe" serializer
    return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
  }
}

/* eslint-disable @typescript-eslint/no-unused-expressions, no-bitwise, no-implicit-coercion */

function serializer(replacer?: Reviver, cycleReplacer?: Reviver): Reviver {
  const stack: any[] = []
  const keys: string[] = []

  const actualCycleReplacer =
    cycleReplacer ??
    ((_key, value) => {
      if (stack[0] === value) {
        return '[Circular ~]'
      }
      return `[Circular ~.${keys.slice(0, stack.indexOf(value)).join('.')}]`
    })

  return function (key, value) {
    let processedValue = value

    if (stack.length > 0) {
      const thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos
        ? keys.splice(thisPos, Number.POSITIVE_INFINITY, key)
        : keys.push(key)
      if (~stack.indexOf(processedValue)) {
        processedValue = actualCycleReplacer.call(this, key, processedValue)
      }
    } else {
      stack.push(processedValue)
    }

    return replacer == null
      ? processedValue
      : replacer.call(this, key, processedValue)
  }
}

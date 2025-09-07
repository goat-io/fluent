import type { JsonStringifyFunction, StringifyAnyOptions } from '../index'
import { Strings } from '../Strings'

/** Expanded InspectOptions to mirror Node's shape (RN-safe subset implemented) */
export interface InspectOptions {
  depth?: number
  breakLength?: number
  colors?: boolean // ignored in RN-safe impl
  showHidden?: boolean // ignored
  compact?: boolean | number // true => compact JSON; false => pretty
  maxArrayLength?: number | null
  maxStringLength?: number | null
  getters?: 'get' | 'set' | true // ignored
  numericSeparator?: boolean
  sorted?: boolean | ((a: string, b: string) => number)
}

export interface InspectAnyOptions
  extends StringifyAnyOptions,
    InspectOptions {}

const INSPECT_OPT: InspectOptions = {
  breakLength: 80,
  depth: 10,
  compact: false,
  maxArrayLength: null,
  maxStringLength: null,
  numericSeparator: false
}

/**
 * Just a convenience export of a const that fulfills the JsonStringifyFunction interface.
 */
export const inspectAnyStringifyFn: JsonStringifyFunction = obj =>
  inspectAny(obj)

/**
 * Transforms ANY to human-readable string (RN-safe). No node:util dependency.
 */
export function inspectAny(obj: any, opt: InspectAnyOptions = {}): string {
  if (typeof obj === 'function') {
    return inspectCompat(obj, { ...INSPECT_OPT, ...opt })
  }

  return Strings.stringifyAny(obj, {
    ...opt,
    stringifyFn: val => inspectCompat(val, { ...INSPECT_OPT, ...opt })
  })
}

/* ===========================
   Lightweight inspector (RN-safe)
   =========================== */

function inspectCompat(value: unknown, opt: InspectOptions = {}): string {
  const depth = opt.depth ?? 10
  const breakLen = opt.breakLength ?? 80
  const compact =
    opt.compact === true || (typeof opt.compact === 'number' && opt.compact > 0)
  const indent = compact ? 0 : 2
  const seen = new WeakSet<object>()

  const toSerializable = (v: any, d: number): any => {
    // primitives & simple types
    if (
      v === null ||
      typeof v !== 'object' ||
      v instanceof Date ||
      v instanceof RegExp
    ) {
      if (typeof v === 'function') {
        return `[Function ${v.name || 'anonymous'}]`
      }
      if (typeof v === 'symbol') {
        return v.toString()
      }
      if (typeof v === 'bigint') {
        return `${v}n`
      }
      if (v instanceof Error) {
        return `${v.name}: ${v.message}`
      }
      if (v instanceof Date) {
        return v.toISOString()
      }
      if (v instanceof RegExp) {
        return v.toString()
      }
      if (typeof v === 'string') {
        return truncateString(v, opt.maxStringLength)
      }
      if (typeof v === 'number') {
        return formatNumber(v, opt.numericSeparator === true)
      }
      return v
    }

    // circular guard
    if (seen.has(v)) {
      return '[Circular]'
    }
    seen.add(v)

    // depth limit summary
    if (d <= 0) {
      if (Array.isArray(v)) {
        return `[Array(${v.length})]`
      }
      return `[Object ${v.constructor?.name || ''}]`.trim()
    }

    // Maps/Sets
    if (v instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(v.entries()).map(([k, val]) => [
          toSerializable(k, d - 1),
          toSerializable(val, d - 1)
        ])
      }
    }
    if (v instanceof Set) {
      return {
        __type: 'Set',
        values: Array.from(v.values()).map(x => toSerializable(x, d - 1))
      }
    }

    // Array
    if (Array.isArray(v)) {
      const arr = v.map(x => toSerializable(x, d - 1))
      if (typeof opt.maxArrayLength === 'number') {
        return arr.slice(0, opt.maxArrayLength)
      }
      return arr
    }

    // Plain/Object-like
    const keys = Object.keys(v)
    if (opt.sorted) {
      if (typeof opt.sorted === 'function') {
        keys.sort(opt.sorted)
      } else {
        keys.sort()
      }
    }

    const out: Record<string, any> = {}
    for (const k of keys) {
      try {
        out[k] = toSerializable((v as any)[k], d - 1)
      } catch {
        out[k] = '[Unserializable]'
      }
    }
    return out
  }

  let str: string
  try {
    const data = toSerializable(value, depth)
    str = JSON.stringify(data)
  } catch {
    str = '"[Unserializable]"'
  }

  // pretty vs compact, and line-length hint
  if (!compact && str.length > breakLen) {
    try {
      return JSON.stringify(JSON.parse(str), null, indent)
    } catch {
      return str
    }
  }
  if (compact && indent !== 0) {
    try {
      return JSON.stringify(JSON.parse(str), null, 0)
    } catch {
      return str
    }
  }
  return str
}

/* ===========================
   Helpers
   =========================== */

function truncateString(s: string, max: number | null | undefined): string {
  if (typeof max === 'number' && max >= 0 && s.length > max) {
    return `${s.slice(0, Math.max(0, max))}…`
  }
  return s
}

function formatNumber(n: number, sep: boolean): number | string {
  if (!sep) {
    return n
  }
  // Use locale-independent grouping with underscores to avoid i18n variance in logs.
  const [int, dec] = String(n).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '_')
  return dec ? `${grouped}.${dec}` : grouped
}

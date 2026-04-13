export const isString = (fn: any): fn is string => typeof fn === 'string'

export enum ClassType {
  Args = 'args',
  Object = 'objectType',
  Input = 'inputType',
  Interface = 'interface',
}

export interface Type<T = any> extends globalThis.Function {
  new (...args: any[]): T
}

export function flatten<T extends unknown[] = any>(
  arr: T,
): T extends Array<infer R> ? R : never {
  const flat = [].concat(...(arr as any))
  return (flat.some(Array.isArray)
    ? flatten(flat)
    : flat) as unknown as T extends Array<infer R> ? R : never
}

export const isUndefined = (obj: any): obj is undefined =>
  typeof obj === 'undefined'

export const isFunction = (fn: any): boolean => typeof fn === 'function'

export type TargetHost = Record<'target', globalThis.Function>
export function isTargetEqual<T extends TargetHost, U extends TargetHost>(
  a: T,
  b: U,
) {
  return a.target === b.target
}

export function isThrowing(func: () => unknown) {
  try {
    func()
    return false
  } catch {
    return true
  }
}

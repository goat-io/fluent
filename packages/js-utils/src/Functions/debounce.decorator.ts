import { Milliseconds } from '../types'
import type { DebounceOptions, ThrottleOptions } from './debounce'
import { debounce, throttle } from './debounce'

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Debounce(
  wait: Milliseconds,
  opt: DebounceOptions = {}
): MethodDecorator {
  return (target, key, descriptor) => {
    const originalFn = descriptor.value
    descriptor.value = debounce(originalFn as any, wait, opt)
    return descriptor
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Throttle(
  wait: Milliseconds,
  opt: ThrottleOptions = {}
): MethodDecorator {
  return (target, key, descriptor) => {
    const originalFn = descriptor.value
    descriptor.value = throttle(originalFn as any, wait, opt)
    return descriptor
  }
}

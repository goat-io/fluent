
import { PRetryOptions } from '../Promises/pRetry'
import { Promises } from '../Promises'

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Retry(opt: PRetryOptions = {}): MethodDecorator {
  return (target, key, descriptor) => {
    const originalFn = descriptor.value
    descriptor.value = Promises.retryFunction(originalFn as any, opt)
    return descriptor
  }
}
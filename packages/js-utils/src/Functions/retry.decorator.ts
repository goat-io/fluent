import { Promises } from '../Promises'
import { PRetryOptions } from '../Promises/pRetry'

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Retry(opt: PRetryOptions = {}): MethodDecorator {
  return (_target, _key, descriptor) => {
    const originalFn = descriptor.value
    descriptor.value = Promises.retryFunction(originalFn as any, opt)
    return descriptor
  }
}

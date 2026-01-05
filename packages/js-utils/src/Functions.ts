import { debounce, throttle } from './Functions/debounce'
import { Debounce, Throttle } from './Functions/debounce.decorator'
import { Retry } from './Functions/retry.decorator'
import { Milliseconds } from './types'

class FunctionsClass {
  /**
   *
   * @param f
   */
  requestAnimationFrame = (f: any) => {
    setTimeout(() => f(Date.now()), 0)
  }

  debounce = debounce

  throttle = throttle

  sleep = (ms: Milliseconds) => new Promise(resolve => setTimeout(resolve, ms))

  repeatEvery = async (ms: Milliseconds, callback: () => void) => {
    const dateNow = Date.now
    const requestAnimation =
      (typeof window !== 'undefined' && window.requestAnimationFrame) ||
      this.requestAnimationFrame

    let start = dateNow()
    let stop: any

    const intervalFunc = () => {
      if (dateNow() - start >= ms) {
        start += ms
        callback()
      }
      if (!stop) {
        requestAnimation(intervalFunc)
      }
    }

    requestAnimation(intervalFunc)
    return {
      clear: () => {
        stop = 1
      },
    }
  }
  /**
   * Decorator to allow method retry
   *
   * @example
   *```typescript
   *    class C {
   *      constructor(public succeedOnAttempt: number) {}
   *
   *     attempt = 0
   *
   *      `@Functions.retryDecorator({
   *        maxAttempts: 3,
   *        delay: 100,
   *        delayMultiplier: 1,
   *        logAll: true,
   *      })`
   *      async fn(...args: any[]) {
   *        this.attempt++
   *        // console.log(`fn called attempt=${attempt}`, {args})
   *        if (this.attempt >= this.succeedOnAttempt) {
   *          return args
   *        }
   *
   *       throw new Error(`fail`)
   *     }
   *   }
   *```
   * */
  retryMethod = Retry

  /**
   * Decorator to allow method debounce
   *
   * @example
   *```typescript
   *   class C {
   *   '@Functions.debounceMethod(20)'
   *   fn(started: number, n: number): void {
   *     console.log(`#${n} after ${_since(started)}`)
   *   }
   * }
   *```
   * */
  debounceMethod = Debounce

  /**
   * Decorator to allow method throttle
   *
   * @example
   *```typescript
   *   class C {
   *   '@Functions.throttleMethod(20)'
   *   fn(started: number, n: number): void {
   *     console.log(`#${n} after ${_since(started)}`)
   *   }
   * }
   *```
   * */
  throttleMethod = Throttle
}

export const Functions = new FunctionsClass()

Functions.debounceMethod

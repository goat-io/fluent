import { AsyncMemo } from './Memo/asyncMemo.decorator'
import { memoFn } from './Memo/memoFn'
import { Memo as SyncMemo } from './Memo/memo.decorator'
import { memoFnAsync } from './Memo/memoFnAsync'

class MemoClass {
  /**
   * Remembers the output of a sync function
   * ```typescript
   *
   *
   *    async function fnOrig(n = 1): number {
   *         console.log(`fnOrig(${n}) called`)
   *         calledTimes++
   *         return n * 2
   *        }
   *    const memoFn = Memo.syncFn(fnOrig)
   * ```
   */
  syncFn = memoFn
  /**
   * Remembers the output of an async function
   * ```typescript
   *
   *
   *    async function fnOrig(n = 1): Promise<number> {
   *         console.log(`fnOrig(${n}) called`)
   *         calledTimes++
   *         return n * 2
   *        }
   *    const memoFn = Memo.asyncFn(fnOrig)
   * ```
   */
  asyncFn = memoFnAsync
  /**
   * Remembers the output of an async Method
   *
   * @example
   *```typescript
   *
   *    class A {
   *        func(n: number): void {
   *            console.log(`func ${n}`)
   *        }
   *
   *        _@Memo.asyncMethod()
   *        async a(a1: number, a2: number): Promise<number> {
   *            const n = a1 * a2
   *            this.func(n)
   *            return n
   *        }
   *    }
   *
   * ```
   */
  asyncMethod = AsyncMemo
  /**
   * Remembers the output of a sync Method
   *
   * @example
   *```typescript
   *
   *    class A {
   *        func(n: number): void {
   *            console.log(`func ${n}`)
   *        }
   *
   *        '@Memo.syncMethod()'
   *        a(a1: number, a2: number): number {
   *            const n = a1 * a2
   *            this.func(n)
   *            return n
   *        }
   *    }
   *
   * ```
   */
  syncMethod = SyncMemo
}

export const Memo = new MemoClass()

Memo.asyncFn

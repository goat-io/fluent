import { Writable } from 'node:stream'
import { TransformOptions, WritableTyped } from './streams.model'

/**
 * Will push all results to `arr`, will emit nothing in the end.
 */
export function writablePushToArray<TInput>(
  arr: TInput[],
  opt: TransformOptions = {}
): WritableTyped<TInput> {
  return new Writable({
    objectMode: true,
    ...opt,
    write(chunk: TInput, _, cb) {
      arr.push(chunk)
      // callback to signal that we processed input, but not emitting any output
      cb()
    }
  })
}

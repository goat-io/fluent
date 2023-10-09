import { Transform } from 'node:stream'
import { TransformOptions, TransformTyped } from '../streams.model'

export interface TransformBufferOptions extends TransformOptions {
  batchSize: number
}

/**
 * Similar to RxJS bufferCount()
 *
 * @default batchSize is 10
 */
export function transformBuffer<IN = any>(
  opt: TransformBufferOptions,
): TransformTyped<IN, IN[]> {
  const { batchSize } = opt

  let buf: IN[] = []

  return new Transform({
    objectMode: true,
    ...opt,
    transform(chunk, _, cb) {
      buf.push(chunk)

      if (buf.length >= batchSize) {
        cb(null, buf)
        buf = []
      } else {
        cb()
      }
    },
    final(this: Transform, cb) {
      if (buf.length) {
        this.push(buf)
        buf = []
      }

      cb()
    },
  })
}

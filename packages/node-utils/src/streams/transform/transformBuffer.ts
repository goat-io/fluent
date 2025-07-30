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

  // Pre-allocate buffer array to avoid resizing
  let buf: IN[] = new Array(batchSize)
  let bufIndex = 0

  return new Transform({
    objectMode: true,
    ...opt,
    transform(chunk, _, cb) {
      buf[bufIndex++] = chunk

      if (bufIndex >= batchSize) {
        // Pass the filled buffer and create a new pre-allocated one
        cb(null, buf.slice(0, bufIndex))
        buf = new Array(batchSize)
        bufIndex = 0
      } else {
        cb()
      }
    },
    final(this: Transform, cb) {
      if (bufIndex > 0) {
        // Only push the filled portion of the buffer
        this.push(buf.slice(0, bufIndex))
      }
      // Clear references to help GC
      buf = null as any
      cb()
    },
  })
}

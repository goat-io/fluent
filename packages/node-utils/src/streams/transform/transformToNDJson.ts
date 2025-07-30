import { Transform } from 'node:stream'
import { Objects } from '@goatlab/js-utils'
import { TransformTyped } from '../streams.model'

export interface TransformToNDJsonOptions {
  /**
   * If true - will throw an error on JSON.parse / stringify error
   *
   * @default true
   */
  strict?: boolean

  /**
   * If true - will run `sortObjectDeep()` on each object to achieve deterministic sort
   *
   * @default false
   */
  sortObjects?: boolean

  /**
   * @default `\n`
   */
  separator?: string
}

/**
 * Transforms objects (objectMode=true) into chunks \n-terminated JSON strings (readableObjectMode=false).
 */
export function transformToNDJson<TInput = any>(
  opt: TransformToNDJsonOptions = {}
): TransformTyped<TInput, string> {
  const { strict = true, separator = '\n', sortObjects = false } = opt

  return new Transform({
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk: TInput, _, cb) {
      try {
        let processedChunk = chunk
        if (sortObjects) {
          processedChunk = Objects.sortObjectDeep(chunk as any)
        }

        cb(null, JSON.stringify(processedChunk) + separator)
      } catch (err) {
        console.log(err)

        if (strict) {
          cb(err as Error) // emit error
        } else {
          cb() // emit no error, but no result neither
        }
      }
    }
  })
}

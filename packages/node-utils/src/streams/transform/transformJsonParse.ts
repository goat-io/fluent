import { Transform } from 'node:stream'
import { Reviver } from '@goatlab/js-utils'
import { TransformTyped } from '../streams.model'

export interface TransformJsonParseOptions {
  /**
   * If true - will throw an error on JSON.parse / stringify error
   *
   * @default true
   */
  strict?: boolean

  reviver?: Reviver
}

/**
 * Transforms chunks of JSON strings/Buffers (objectMode=false) into parsed objects (readableObjectMode=true).
 *
 * if strict - will throw an error on JSON.parse / stringify error
 *
 * Usage:
 *
 * await _pipeline([
 *   readable,
 *   binarySplit(),
 *   transformJsonParse(),
 *   consumeYourStream...
 * [)
 */
export function transformJsonParse<Out = any>(
  opt: TransformJsonParseOptions = {}
): TransformTyped<string | Buffer, Out> {
  const { strict = true, reviver } = opt

  return new Transform({
    writableObjectMode: false,
    readableObjectMode: true,
    transform(chunk: string, _, cb) {
      try {
        const data = JSON.parse(chunk, reviver)
        cb(null, data)
      } catch (err) {
        if (strict) {
          cb(err as Error) // emit error
        } else {
          console.log(err)
          cb() // emit no error, but no result neither
        }
      }
    }
  })
}

// Based on: https://stackoverflow.com/a/34557997/4919972
export const bufferReviver: Reviver = (_k, v) => {
  if (
    v !== null &&
    typeof v === 'object' &&
    v.type === 'Buffer' &&
    Array.isArray(v.data)
  ) {
    return Buffer.from(v.data)
  }

  return v
}

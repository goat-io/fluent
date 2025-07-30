import { Transform } from 'node:stream'
import { Predicate } from '@goatlab/js-utils'
import { TransformOptions, TransformTyped } from '../streams.model'
import {
  AsyncPredicate,
  TransformMapOptions,
  transformMap
} from './transformMap'

/**
 * Just a convenience wrapper around `transformMap` that has built-in predicate filtering support.
 */
export function transformFilter<In = any>(
  predicate: AsyncPredicate<In>,
  opt: TransformMapOptions = {}
): TransformTyped<In, In> {
  return transformMap(v => v, {
    predicate,
    ...opt
  })
}

/**
 * Sync version of `transformFilter`
 */
export function transformFilterSync<In = any>(
  predicate: Predicate<In>,
  opt: TransformOptions = {}
): TransformTyped<In, In> {
  let index = 0

  return new Transform({
    objectMode: true,
    ...opt,
    transform(chunk: In, _, cb) {
      try {
        if (predicate(chunk, index++)) {
          cb(null, chunk) // pass through
        } else {
          cb() // signal that we've finished processing, but emit no output here
        }
      } catch (err) {
        cb(err as Error)
      }
    }
  })
}

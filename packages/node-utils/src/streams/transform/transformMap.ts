import { CommonLogger, ErrorMode, Errors } from '@goatlab/js-utils'
import {
  AbortableAsyncMapper,
  END,
  SKIP,
} from '@goatlab/js-utils/dist/Promises/pMap'

import through2Concurrent = require('through2-concurrent')

import { yellow } from 'kleur/colors'
import { pFilter } from '../pFilter'
import { AbortableTransform } from '../pipeline'
import { pipelineClose } from '../pipelineClose'
import { TransformTyped } from '../streams.model'
export type AsyncPredicate<T> = (
  item: T,
  index: number,
) => boolean | PromiseLike<boolean>

export interface TransformMapOptions<In = any, Out = In> {
  /**
   * Set true to support "multiMap" - possibility to return [] and emit 1 result for each item in the array.
   *
   * @default false
   */
  flattenArrayOutput?: boolean

  /**
   * Predicate to filter outgoing results (after mapper).
   * Allows to not emit all results.
   *
   * Defaults to "pass everything" (including null, undefined, etc).
   * Simpler way to exclude certain cases is to return SKIP symbol from the mapper.
   */
  predicate?: AsyncPredicate<Out>

  /**
   * Number of concurrently pending promises returned by `mapper`.
   *
   * @default 16 (to match default highWatermark option for objectMode streams)
   */
  concurrency?: number

  /**
   * @default THROW_IMMEDIATELY
   */
  errorMode?: ErrorMode

  /**
   * If defined - will be called on every error happening in the stream.
   * Called BEFORE observable will emit error (unless skipErrors is set to true).
   */
  onError?: (err: Error, input: In) => any

  /**
   * Progress metric
   *
   * @default `stream`
   */
  metric?: string

  logger?: CommonLogger
}

// doesn't work, cause here we don't construct our Transform instance ourselves
// export class TransformMap extends AbortableTransform {}

/**
 * Like pMap, but for streams.
 * Inspired by `through2`.
 * Main feature is concurrency control (implemented via `through2-concurrent`) and convenient options.
 * Using this allows native stream .pipe() to work and use backpressure.
 *
 * Only works in objectMode (due to through2Concurrent).
 *
 * Concurrency defaults to 16.
 *
 * If an Array is returned by `mapper` - it will be flattened and multiple results will be emitted from it. Tested by Array.isArray().
 */
export function transformMap<In = any, Out = In>(
  mapper: AbortableAsyncMapper<In, Out | typeof SKIP | typeof END>,
  opt: TransformMapOptions<In, Out> = {},
): TransformTyped<In, Out> {
  const {
    concurrency = 16,
    predicate, // we now default to "no predicate" (meaning pass-everything)
    errorMode = ErrorMode.ThrowImmediately,
    flattenArrayOutput,
    onError,
    metric = 'stream',
    logger = console,
  } = opt

  let index = -1
  let isSettled = false
  let errors = 0
  // Only allocate collectedErrors array if needed
  const collectedErrors: Error[] | null =
    errorMode === ErrorMode.ThrowAggregated ? [] : null

  return through2Concurrent.obj(
    {
      maxConcurrency: concurrency,
      async final(cb) {
        // console.log('transformMap final')

        logErrorStats(true)

        if (collectedErrors?.length) {
          // emit Aggregated error
          cb(
            new AggregateError(
              collectedErrors,
              `transformMap resulted in ${collectedErrors.length} error(s)`,
            ),
          )
        } else {
          // emit no error
          cb()
        }
      },
    },
    async function transformMapFn(this: AbortableTransform, chunk: In, _, cb) {
      // Stop processing if isSettled (either THROW_IMMEDIATELY was fired or END received)
      if (isSettled) {
        return cb()
      }

      const currentIndex = ++index

      try {
        const res = await mapper(chunk, currentIndex)
        const passedResults = await pFilter(
          flattenArrayOutput && Array.isArray(res) ? res : [res],
          async r => {
            if (r === END) {
              isSettled = true // will be checked later
              return false
            }
            return (
              r !== SKIP && (!predicate || (await predicate(r, currentIndex)))
            )
          },
        )

        // Use for loop for better performance with large arrays
        for (let i = 0; i < passedResults.length; i++) {
          this.push(passedResults[i])
        }

        if (isSettled) {
          logger.log(`transformMap END received at index ${currentIndex}`)
          pipelineClose(
            'transformMap',
            this,
            this.sourceReadable,
            this.streamDone,
            logger,
          )
        }

        cb() // done processing
      } catch (err) {
        logger.log(err)
        errors++
        logErrorStats()

        if (onError) {
          try {
            onError(Errors.anyToError(err), chunk)
          } catch {
            // Ignore errors from error handler
          }
        }

        if (errorMode === ErrorMode.ThrowImmediately) {
          isSettled = true
          return cb(err) // Emit error immediately
        }

        if (errorMode === ErrorMode.ThrowAggregated && collectedErrors) {
          collectedErrors.push(err as Error)
        }

        // Tell input stream that we're done processing, but emit nothing to output - not error nor result
        cb()
      }
    },
  )

  function logErrorStats(final = false): void {
    if (!errors) {
      return
    }
    logger.log(`${metric} ${final ? 'final ' : ''}errors: ${yellow(errors)}`)
  }
}

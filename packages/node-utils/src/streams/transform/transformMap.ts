import { CommonLogger, ErrorMode, Errors } from '@goatlab/js-utils'
import {
  AbortableAsyncMapper,
  END,
  SKIP,
} from '@goatlab/js-utils/dist/Promises/pMap'
import through2Concurrent = require('through2-concurrent')
import { TransformTyped } from '../streams.model'
import { AbortableTransform } from '../pipeline'
import { pFilter } from '../pFilter'
import { pipelineClose } from '../pipelineClose'
import { yellow } from 'kleur/colors'
export type AsyncPredicate<T> = (
  item: T,
  index: number,
) => boolean | PromiseLike<boolean>

export interface TransformMapOptions<IN = any, OUT = IN> {
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
  predicate?: AsyncPredicate<OUT>

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
  onError?: (err: Error, input: IN) => any

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
export function transformMap<IN = any, OUT = IN>(
  mapper: AbortableAsyncMapper<IN, OUT | typeof SKIP | typeof END>,
  opt: TransformMapOptions<IN, OUT> = {},
): TransformTyped<IN, OUT> {
  const {
    concurrency = 16,
    predicate, // we now default to "no predicate" (meaning pass-everything)
    errorMode = ErrorMode.THROW_IMMEDIATELY,
    flattenArrayOutput,
    onError,
    metric = 'stream',
    logger = console,
  } = opt

  let index = -1
  let isSettled = false
  let errors = 0
  const collectedErrors: Error[] = [] // only used if errorMode == THROW_AGGREGATED

  return through2Concurrent.obj(
    {
      maxConcurrency: concurrency,
      async final(cb) {
        // console.log('transformMap final')

        logErrorStats(true)

        if (collectedErrors.length) {
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
    async function transformMapFn(this: AbortableTransform, chunk: IN, _, cb) {
      // Stop processing if isSettled (either THROW_IMMEDIATELY was fired or END received)
      if (isSettled) return cb()

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

        passedResults.forEach(r => this.push(r))

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
        logger.error(err)
        errors++
        logErrorStats()

        if (onError) {
          try {
            onError(Errors.anyToError(err), chunk)
          } catch {}
        }

        if (errorMode === ErrorMode.THROW_IMMEDIATELY) {
          isSettled = true
          return cb(err) // Emit error immediately
        }

        if (errorMode === ErrorMode.THROW_AGGREGATED) {
          collectedErrors.push(err as Error)
        }

        // Tell input stream that we're done processing, but emit nothing to output - not error nor result
        cb()
      }
    },
  )

  function logErrorStats(final = false): void {
    if (!errors) return
    logger.log(`${metric} ${final ? 'final ' : ''}errors: ${yellow(errors)}`)
  }
}

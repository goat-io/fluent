import {
  CommonLogger,
  ErrorMode,
  Errors,
  Mapper,
  Predicate,
} from '@goatlab/js-utils'
import { AbortableTransform } from '../pipeline'
import { END, SKIP } from '@goatlab/js-utils/dist/Promises/pMap'
import { TransformTyped } from '../streams.model'
import { pipelineClose } from '../pipelineClose'
import { yellow } from 'kleur/colors'

export interface TransformMapSyncOptions<IN = any, OUT = IN> {
  /**
   * @default true
   */
  objectMode?: boolean

  /**
   * @default false
   * Set true to support "multiMap" - possibility to return [] and emit 1 result for each item in the array.
   */
  flattenArrayOutput?: boolean

  /**
   * Predicate to filter outgoing results (after mapper).
   * Allows to not emit all results.
   *
   * Defaults to "pass everything".
   * Simpler way to skip individual entries is to return SKIP symbol.
   */
  predicate?: Predicate<OUT>

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

export class TransformMapSync extends AbortableTransform {}

/**
 * Sync (not async) version of transformMap.
 * Supposedly faster, for cases when async is not needed.
 */
export function transformMapSync<IN = any, OUT = IN>(
  mapper: Mapper<IN, OUT | typeof SKIP | typeof END>,
  opt: TransformMapSyncOptions = {},
): TransformTyped<IN, OUT> {
  let index = -1

  const {
    predicate, // defaults to "no predicate" (pass everything)
    errorMode = ErrorMode.THROW_IMMEDIATELY,
    flattenArrayOutput = false,
    onError,
    metric = 'stream',
    objectMode = true,
    logger = console,
  } = opt
  let isSettled = false
  let errors = 0
  const collectedErrors: Error[] = [] // only used if errorMode == THROW_AGGREGATED

  return new TransformMapSync({
    objectMode,
    ...opt,
    transform(this: AbortableTransform, chunk: IN, _, cb) {
      // Stop processing if isSettled
      if (isSettled) return cb()

      const currentIndex = ++index

      try {
        // map and pass through
        const v = mapper(chunk, currentIndex)

        const passedResults = (
          flattenArrayOutput && Array.isArray(v) ? v : [v]
        ).filter(r => {
          if (r === END) {
            isSettled = true // will be checked later
            return false
          }
          return r !== SKIP && (!predicate || predicate(r, currentIndex))
        })

        passedResults.forEach(r => this.push(r))

        if (isSettled) {
          logger.log(`transformMapSync END received at index ${currentIndex}`)
          pipelineClose(
            'transformMapSync',
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
          // Emit error immediately
          return cb(err as Error)
        }

        if (errorMode === ErrorMode.THROW_AGGREGATED) {
          collectedErrors.push(err as Error)
        }

        cb()
      }
    },
    final(cb) {
      // console.log('transformMap final')

      logErrorStats(true)

      if (collectedErrors.length) {
        // emit Aggregated error
        cb(
          new AggregateError(
            collectedErrors,
            `transformMapSync resulted in ${collectedErrors.length} error(s)`,
          ),
        )
      } else {
        // emit no error
        cb()
      }
    },
  })

  function logErrorStats(final = false): void {
    if (!errors) return

    logger.log(`${metric} ${final ? 'final ' : ''}errors: ${yellow(errors)}`)
  }
}

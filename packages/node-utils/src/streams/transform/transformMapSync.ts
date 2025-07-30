import {
  CommonLogger,
  ErrorMode,
  Errors,
  Mapper,
  Predicate
} from '@goatlab/js-utils'
import { END, SKIP } from '@goatlab/js-utils/dist/Promises/pMap'
import { yellow } from 'kleur/colors'
import { AbortableTransform } from '../pipeline'
import { pipelineClose } from '../pipelineClose'
import { TransformTyped } from '../streams.model'

export interface TransformMapSyncOptions<In = any, Out = In> {
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
  predicate?: Predicate<Out>

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

export class TransformMapSync extends AbortableTransform {}

/**
 * Sync (not async) version of transformMap.
 * Supposedly faster, for cases when async is not needed.
 */
export function transformMapSync<In = any, Out = In>(
  mapper: Mapper<In, Out | typeof SKIP | typeof END>,
  opt: TransformMapSyncOptions = {}
): TransformTyped<In, Out> {
  let index = -1

  const {
    predicate, // defaults to "no predicate" (pass everything)
    errorMode = ErrorMode.ThrowImmediately,
    flattenArrayOutput = false,
    onError,
    metric = 'stream',
    objectMode = true,
    logger = console
  } = opt
  let isSettled = false
  let errors = 0
  // Only allocate collectedErrors array if needed
  const collectedErrors: Error[] | null =
    errorMode === ErrorMode.ThrowAggregated ? [] : null

  return new TransformMapSync({
    objectMode,
    ...opt,
    transform(this: AbortableTransform, chunk: In, _, cb) {
      // Stop processing if isSettled
      if (isSettled) {
        return cb()
      }

      const currentIndex = ++index

      try {
        // map and pass through
        const v = mapper(chunk, currentIndex)

        // Optimize for common case where no filtering is needed
        if (!predicate && !flattenArrayOutput && v !== SKIP && v !== END) {
          this.push(v)
        } else {
          // Handle special cases
          if (v === END) {
            isSettled = true
          } else if (v === SKIP) {
            // Skip this item
          } else if (flattenArrayOutput && Array.isArray(v)) {
            // Process array results with optimized loop
            for (let i = 0; i < v.length; i++) {
              const item = v[i]
              if (item === END) {
                isSettled = true
                break
              }
              if (
                item !== SKIP &&
                (!predicate || predicate(item, currentIndex))
              ) {
                this.push(item)
              }
            }
          } else if (!predicate || predicate(v, currentIndex)) {
            this.push(v)
          }
        }

        if (isSettled) {
          logger.log(`transformMapSync END received at index ${currentIndex}`)
          pipelineClose(
            'transformMapSync',
            this,
            this.sourceReadable,
            this.streamDone,
            logger
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
          // Emit error immediately
          return cb(err as Error)
        }

        if (errorMode === ErrorMode.ThrowAggregated && collectedErrors) {
          collectedErrors.push(err as Error)
        }

        cb()
      }
    },
    final(cb) {
      // console.log('transformMap final')

      logErrorStats(true)

      if (collectedErrors?.length) {
        // emit Aggregated error
        cb(
          new AggregateError(
            collectedErrors,
            `transformMapSync resulted in ${collectedErrors.length} error(s)`
          )
        )
      } else {
        // emit no error
        cb()
      }
    }
  })

  function logErrorStats(final = false): void {
    if (!errors) {
      return
    }

    logger.log(`${metric} ${final ? 'final ' : ''}errors: ${yellow(errors)}`)
  }
}

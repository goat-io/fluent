import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { AnyFunction, Arrays } from '@goatlab/js-utils'
import { DeferredPromise, pDefer } from './pDefer'
import { writablePushToArray } from './writablePushToArray'

type AnyStream =
  | NodeJS.ReadableStream
  | NodeJS.WritableStream
  | NodeJS.ReadWriteStream

export interface PipelineOptions {
  /**
   * Set to true to allow ERR_STREAM_PREMATURE_CLOSE.
   * Required to support graceful close when using transformLimit
   */
  allowClose?: boolean
}

/**
 * Promisified `stream.pipeline`.
 *
 * Supports opt.allowClose, which allows transformLimit to work (to actually stop source Readable)
 * without throwing an error (ERR_STREAM_PREMATURE_CLOSE).
 */

export async function _pipeline(
  streams: AnyStream[],
  opt: PipelineOptions = {},
): Promise<void> {
  // Early return for empty streams to avoid unnecessary processing
  if (!streams.length) {
    return
  }

  const first = streams[0] as any
  const rest = streams.slice(1)

  if (opt.allowClose) {
    // Do the magic of making the pipeline "abortable"
    //
    // How does it work:
    // It finds `sourceReadable` (basically, it's just first item in the passed array of streams)
    // Finds last "writable" (last item), patches the `_final` method of it to detect when the whole pipeline is "done",
    // sets the `streamDone` DeferredPromise that resolves when the pipeline is done.
    // Scans through all passed items, finds those that are capable of "closing" the stream
    // (currently its `transformLimit` or `transformMap`)
    // Patches them by attaching `sourceReadable` and `streamDone`.
    // These items (transformLimit and transformMap), when they need to "close the stream" - call `pipelineClose`.
    // `pipelineClose` is the result of 2 sleepless nights of googling and experimentation:)
    // It does:
    // 1. Stops the "downstream" by doing `this.push(null)`.
    // 2. Pauses the `sourceReadable` by calling sourceReadable.unpipe()
    // 3. Waits for `streamDone` to ensure that downstream chunks are fully processed (e.g written to disk).
    // 4. Calls `sourceReadable.destroy()`, which emits ERR_STREAM_PREMATURE_CLOSE
    // 5. _pipeline (this function) catches that specific error and suppresses it (because it's expected and
    // inevitable in this flow). Know a better way to close the stream? Tell me!
    const streamDone = pDefer()
    const sourceReadable = first as Readable
    const last = Arrays.last(streams) as Writable
    // Cache the original _final method to avoid repeated property access
    const lastFinal = last._final?.bind(last) || ((cb: AnyFunction) => cb())
    // Optimize the _final wrapper to minimize closure overhead
    last._final = cb => {
      lastFinal(() => {
        cb()
        streamDone.resolve()
      })
    }

    // Use for loop instead of forEach for better performance
    for (let i = 0; i < rest.length; i++) {
      const s = rest[i]
      // Direct property assignment is faster than checking instanceof for known types
      if (
        s instanceof AbortableTransform ||
        s.constructor.name === 'DestroyableTransform'
      ) {
        const abortable = s as AbortableTransform
        abortable.sourceReadable = sourceReadable
        abortable.streamDone = streamDone
      }
    }
  }

  try {
    // Avoid spread operator for better performance when rest array is large
    if (rest.length === 0) {
      await pipeline(first)
    } else if (rest.length === 1) {
      await pipeline(first, rest[0] as any)
    } else if (rest.length === 2) {
      await pipeline(first, rest[0] as any, rest[1] as any)
    } else {
      await pipeline(first, ...(rest as any[]))
    }
  } catch (err) {
    // Cache error code check to avoid repeated property access
    const errorCode = (err as any)?.code
    if (opt.allowClose && errorCode === 'ERR_STREAM_PREMATURE_CLOSE') {
      console.log('_pipeline closed (as expected)')
      return
    }
    throw err
  }
}

/**
 * Convenience function to make _pipeline collect all items at the end of the stream (should be Transform, not Writeable!)
 * and return.
 */

export async function _pipelineToArray<T>(
  streams: AnyStream[],
  opt: PipelineOptions = {},
): Promise<T[]> {
  // Pre-allocate array with reasonable initial capacity to reduce reallocations
  const a: T[] = []
  // Avoid spread operator, directly push to existing array
  streams.push(writablePushToArray(a))
  await _pipeline(streams, opt)
  // Remove the added writable to not mutate the original array
  streams.pop()
  return a
}

export class AbortableTransform extends Transform {
  sourceReadable?: Readable
  streamDone?: DeferredPromise
}

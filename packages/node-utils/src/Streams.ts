import { Readable, ReadableOptions } from 'node:stream'
import { _pipeline } from './streams/pipeline'
import { ReadableTyped } from './streams/streams.model'
import type { transformMap } from './streams/transform/transformMap'
import type { transformBuffer } from './streams/transform/transformBuffer'
import type { transformFilter } from './streams/transform/transformFilter'
import type { transformGzip } from './streams/transform/transformGzip'
import type { transformLogProgress } from './streams/transform/transformLogProgress'
import type { transformToFile } from './streams/transform/transformToFile'
import type { transformToNDJson } from './streams/transform/transformToNDJson'
import type { writableVoid } from './streams/writableVoid'
import type { transformMapSync } from './streams/transform/transformMapSync'
import type { transformUnGzip } from './streams/transform/transformUnGZip'
import type { transformJsonParse } from './streams/transform/transformJsonParse'

class StreamClass {
  pipeline = _pipeline

  readableFrom<T>(
    items: Iterable<T> | AsyncIterable<T>,
    opt?: ReadableOptions
  ): ReadableTyped<T> {
    return Readable.from(items, opt)
  }

  get map() {
    return require('./streams/transform/transformMap')
      .transformMap as typeof transformMap
  }

  get mapSync() {
    return require('./streams/transform/transformMapSync')
      .transformMapSync as typeof transformMapSync
  }

  get buffer() {
    return require('./streams/transform/transformBuffer')
      .transformBuffer as typeof transformBuffer
  }

  get filter() {
    return require('./streams/transform/transformFilter')
      .transformFilter as typeof transformFilter
  }

  get gzip() {
    return require('./streams/transform/transformGzip')
      .transformGzip as typeof transformGzip
  }

  get unGzip() {
    return require('./streams/transform/transformUnGzip')
      .transformUnGzip as typeof transformUnGzip
  }

  get logProgress() {
    return require('./streams/transform/transformLogProgress')
      .transformLogProgress as typeof transformLogProgress
  }

  get toWriteStream() {
    return require('./streams/transform/transformToFile')
      .transformToFile as typeof transformToFile
  }

  get toNDJson() {
    return require('./streams/transform/transformToNDJson')
      .transformToNDJson as typeof transformToNDJson
  }

  get parseJson() {
    return require('./streams/transform/transformJsonParse')
      .transformJsonParse as typeof transformJsonParse
  }

  get closePipeline() {
    return require('./streams/writableVoid').writableVoid as typeof writableVoid
  }
}

export const Streams = new StreamClass()

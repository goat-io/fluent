import { Readable, ReadableOptions } from 'node:stream'
import { _pipeline } from './streams/pipeline'
import { ReadableTyped } from './streams/streams.model'
import { transformBuffer } from './streams/transform/transformBuffer'
import { transformFilter } from './streams/transform/transformFilter'
import { transformGzip } from './streams/transform/transformGzip'
import { transformJsonParse } from './streams/transform/transformJsonParse'
import { transformLogProgress } from './streams/transform/transformLogProgress'
import { transformMap } from './streams/transform/transformMap'
import { transformMapSync } from './streams/transform/transformMapSync'
import { transformToFile } from './streams/transform/transformToFile'
import { transformToNDJson } from './streams/transform/transformToNDJson'
import { transformUnGzip } from './streams/transform/transformUnGZip'
import { writableVoid } from './streams/writableVoid'

class StreamClass {
  pipeline = _pipeline
  map = transformMap
  mapSync = transformMapSync
  buffer = transformBuffer
  filter = transformFilter
  gzip = transformGzip
  unGzip = transformUnGzip
  logProgress = transformLogProgress
  toWriteStream = transformToFile
  toNDJson = transformToNDJson
  parseJson = transformJsonParse
  closePipeline = writableVoid

  readableFrom<T>(
    items: Iterable<T> | AsyncIterable<T>,
    opt?: ReadableOptions,
  ): ReadableTyped<T> {
    return Readable.from(items, opt)
  }
}

export const Streams = new StreamClass()

import { Readable, Transform, Writable } from 'node:stream'

export interface ReadableTyped<_T> extends Readable {}

export interface WritableTyped<_T> extends Writable {}

export interface TransformTyped<TInput, _OUT = TInput> extends Transform {}

export interface TransformOptions {
  /**
   * @default true
   */
  objectMode?: boolean

  /**
   * @default 16
   */
  highWaterMark?: number
}

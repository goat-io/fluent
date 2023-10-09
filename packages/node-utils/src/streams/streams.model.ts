import { Readable, Transform, Writable } from 'node:stream'

// eslint-disable-next-line unused-imports/no-unused-vars
export interface ReadableTyped<T> extends Readable {}

// eslint-disable-next-line unused-imports/no-unused-vars
export interface WritableTyped<T> extends Writable {}

// eslint-disable-next-line unused-imports/no-unused-vars
export interface TransformTyped<IN, OUT = IN> extends Transform {}

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

import { TypedPathWrapper } from 'typed-path'
import type { ObjectID } from 'bson'

export type Primitives = boolean | string | number | ObjectID
export type PrimitivesArray = boolean[] | string[] | number[] | ObjectID[]

export type AnyFunction = (...args: any[]) => any

export type Reviver = (this: any, key: string, value: any) => any

export type Class<T = any> = new (...args: any[]) => T

export const _noop = (..._args: any[]): undefined => undefined

export interface StringMap<T = string> {
  [k: string | number]: T | undefined
}

export type Mapper<IN = any, OUT = any> = (input: IN, index: number) => OUT

export type Predicate<T> = (item: T, index: number) => boolean

export type NullishValue = null | undefined
export type FalsyValue = false | '' | 0 | null | undefined

export type AnyObject = Record<string, any>

export type ObjectPredicate<OBJ> = (
  key: keyof OBJ,
  value: Exclude<OBJ[keyof OBJ], undefined>,
  obj: OBJ
) => boolean

export type ObjectMapper<OBJ, OUT> = (
  key: string,
  value: Exclude<OBJ[keyof OBJ], undefined>,
  obj: OBJ
) => OUT

export type ValueOf<T> = T[keyof T]

export const stringMapEntries = Object.entries as <T>(
  m: StringMap<T>
) => [k: string, v: T][]

export type TypedKeys<T> = (
  key: TypedPathWrapper<T, Record<never, never>>
) =>
  | TypedPathWrapper<Primitives, Record<never, never>>
  | TypedPathWrapper<Primitives[], Record<never, never>>

/**
 * Interface explicitly states that the value is an ISO Date string (without time).
 * YYYY-MM-DD
 *
 * @example '2019-06-21'
 */
export declare type IsoDateString = string
/**
 * Interface explicitly states that the value is an ISO DateTime string (with time).
 * YYYY-MM-DDThh:mm:ssZ
 *
 * @example '2019-06-21T05:21:73Z'
 */
export declare type IsoDateTimeString = string
/**
 * Interface explicitly states that the value is a Unix timestamp (in seconds).
 * 10 digits!
 * @example 1628945450
 */
export declare type UnixTimestampNumber = number
/**
 * Interface explicitly states that the value is a "Unix timestamp in **milleseconds**" (not seconds). 13 digits!
 *
 * @example 1628945450000
 */
export declare type UnixTimestampMillisNumber = number

/**
 * Interface explicitly states that the value is a Millisecond number.
 *
 * @example 300
 */
export declare type Milliseconds = number
/**
 * Same as `number`, but with semantic meaning that it is an Integer.
 */
export declare type Integer = number

export type Promisable<T> = T | PromiseLike<T>

export type Nullish<T> = T extends NullishValue ? T : never
export type Truthy<T> = T extends FalsyValue ? never : T
export type Falsy<T> = T extends FalsyValue ? T : never

export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint

/**
 * Allows to identify instance of Class by `instanceId`.
 */
export interface InstanceId {
  /**
   * Unique id of this instance of the Class.
   */
  instanceId: string
}

// Get the type from an array TYPE[] => TYPE
export type Unpacked<T> = T extends (infer U)[] ? U : T

export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
  ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
  : T extends object
  ? T extends infer O
    ? O extends any[]
      ? { [K in keyof Unpacked<O>]: ExpandRecursively<Unpacked<O>[K]> }[]
      : { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T

export type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property]
}

export type Subset<T, U> = {
  [key in keyof T]: key extends keyof U ? T[key] : never
}

export interface PaginatedData<T> {
  /**
   *
   */
  currentPage: number
  /**
   * The actual result data
   */
  data: T[]
  firstPageUrl?: string
  nextPageUrl?: string
  prevPageUrl?: string
  path?: string
  /**
   * Number of results on each page
   */
  perPage: number
  /**
   * Total number of results for the query
   */
  total: number
  /**
   * Last page number
   */
  lastPage: number
  /**
   * First page number
   */
  firstPage: number
  /**
   * Next page number
   */
  nextPage: number
  /**
   * Previous page number
   */
  prevPage: number | null
  /**
   * Showing results from
   */
  from: number
  /**
   * Showing results to
   */
  to: number
}

export interface Paginator {
  page: number
  perPage: number
}

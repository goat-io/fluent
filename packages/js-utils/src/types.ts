import { TypedPathWrapper } from 'typed-path'
import type { ObjectID } from 'bson'

// Basic primitive types that can be used in various contexts
export type Primitives = boolean | string | number | ObjectID
// Arrays of primitive types
export type PrimitivesArray = boolean[] | string[] | number[] | ObjectID[]

// Generic function type that accepts any arguments and returns any value
export type AnyFunction = (...args: any[]) => any

// Function type for JSON.parse reviver parameter
export type Reviver = (this: any, key: string, value: any) => any

// Generic class constructor type
export type Class<T = any> = new (...args: any[]) => T

// No-operation function that accepts any arguments and returns undefined
export const _noop = (..._args: any[]): undefined => undefined

// Map-like interface with string/number keys and optional values
export interface StringMap<T = string> {
  [k: string | number]: T | undefined
}

// Function type for mapping operations with index parameter
export type Mapper<IN = any, OUT = any> = (input: IN, index: number) => OUT

// Function type for filtering operations with index parameter
export type Predicate<T> = (item: T, index: number) => boolean

// Union type for null or undefined values
export type NullishValue = null | undefined
// Union type for all falsy values in JavaScript
export type FalsyValue = false | '' | 0 | null | undefined

// Generic object type with string keys and any values
export type AnyObject = Record<string, any>

// Predicate function type for object operations
export type ObjectPredicate<OBJ> = (
  key: keyof OBJ,
  value: Exclude<OBJ[keyof OBJ], undefined>,
  obj: OBJ
) => boolean

// Mapper function type for object transformations
export type ObjectMapper<OBJ, OUT> = (
  key: string,
  value: Exclude<OBJ[keyof OBJ], undefined>,
  obj: OBJ
) => OUT

// Utility type to extract all possible values from an object type
export type ValueOf<T> = T[keyof T]

// Typed version of Object.entries for StringMap
export const stringMapEntries = Object.entries as <T>(
  m: StringMap<T>
) => [k: string, v: T][]

// Type for defining typed keys that resolve to primitive values or arrays
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

// Type that can be either a value T or a Promise-like of T
export type Promisable<T> = T | PromiseLike<T>

// Utility type to extract only nullish values from a type
export type Nullish<T> = T extends NullishValue ? T : never
// Utility type to extract only truthy values from a type
export type Truthy<T> = T extends FalsyValue ? never : T
// Utility type to extract only falsy values from a type
export type Falsy<T> = T extends FalsyValue ? T : never

// Union of all JavaScript primitive types
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

// Recursively expand all nested types for better type display
export type ExpandRecursively<T> = T extends (...args: infer A) => infer R
  ? (...args: ExpandRecursively<A>) => ExpandRecursively<R>
  : T extends object
  ? T extends infer O
    ? O extends any[]
      ? { [K in keyof Unpacked<O>]: ExpandRecursively<Unpacked<O>[K]> }[]
      : { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T

// Make all properties in T required (remove optional modifiers)
export type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property]
}

// Create a subset type where only keys that exist in U are preserved
export type Subset<T, U> = {
  [key in keyof T]: key extends keyof U ? T[key] : never
}

export type IterableItem<T> = T extends Iterable<infer U> ? U : never

// Interface for paginated data responses
export interface PaginatedData<T> {
  /**
   * Current page number
   */
  currentPage: number
  /**
   * The actual result data
   */
  data: T[]
  // URL for the first page
  firstPageUrl?: string
  // URL for the next page
  nextPageUrl?: string
  // URL for the previous page
  prevPageUrl?: string
  // Base path for pagination URLs
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

// Interface for pagination parameters
export interface Paginator {
  // Page number to retrieve
  page: number
  // Number of items per page
  perPage: number
}

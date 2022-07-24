import { ObjectID } from 'bson'
import { z } from 'zod'

export interface AnyObject {
  id?: string
  _id?: string
  [key: string]: any
}

// Get the type from an array TYPE[] => TYPE
type Unpacked<T> = T extends (infer U)[] ? U : T

export type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property]
}

export type QueryFieldSelector<T> = Partial<{
  [K in keyof Concrete<T>]: Concrete<T>[K] extends object
    ? Unpacked<Partial<QueryFieldSelector<Concrete<T>[K]>>>
    : boolean | undefined
}>

export type QueryOrderSelector<T> = Partial<{
  [K in keyof Concrete<T>]: Concrete<T>[K] extends object
    ? Partial<QueryOrderSelector<Concrete<T>[K]>>
    : 'asc' | 'desc' | undefined
}>

export type QueryOperations<T> = {
  [key in LogicOperator]: T
}

export type QueryWhereFitler<T> = Partial<{
  [K in keyof Concrete<T>]: Concrete<T>[K] extends object
    ? Partial<QueryWhereFitler<Concrete<T>[K]>>
    : Partial<QueryOperations<Concrete<T>[K]>> | T[K]
}>

export type QueryInsert<T> = {
  [K in keyof T]: T[K] extends object ? QueryInsert<T[K]> : T[K]
}

export type ModelRelation<T> = T

export type QueryIncludeRelation<T> = {
  [K in keyof Partial<T>]: FluentQuery<Unpacked<T[K]>> | boolean
}

export type FluentQuery<T> = {
  select?: QueryFieldSelector<T>
  where?:
    | {
        OR: FluentQuery<T>['where'][]
        AND: FluentQuery<T>['where'][]
      }
    | QueryWhereFitler<T>
  orderBy?: QueryOrderSelector<T>[]
  limit?: number
  offset?: number
  include?: QueryIncludeRelation<T>
}

type Nullable<T> = T extends null | undefined ? never : Partial<T>

export type QueryOutput<
  T extends FluentQuery<Model>,
  Model,
  OutputDTO
> = T extends {
  select: T['select']
}
  ? {
      // Check nested objects
      // Is the selected key an object? A.K.A -> nested attribute
      [P in keyof T['select']]: T['select'][P] extends object
        ? QueryOutput<
            { select: T['select'][P] },
            Model[P] extends null | undefined 
              ? Nullable<Model[P]>
              : NonNullable<Model[P]>,
            OutputDTO[P]
          >
        : Model[P]
    }
  : OutputDTO

export interface PaginatedData<T> {
  current_page: number
  data: T[]
  first_page_url: string
  next_page_url: string
  prev_page_url: string
  path: string
  per_page: number
  total: number
}

export interface Paginator {
  page: number
  perPage
}

export interface Deleted {
  deleted: number
}

export type Primitives = boolean | string | number | ObjectID
export type PrimitivesArray = boolean[] | string[] | number[] | ObjectID[]

export enum LogicOperator {
  equals = 'equals',
  lessThan = 'lessThan',
  greaterThan = 'greaterThan',
  lessOrEqualThan = 'lessOrEqualThan',
  greaterOrEqualThan = 'greaterOrEqualThan',
  isNot = 'isNot',
  in = 'in',
  notIn = 'notIn',
  like = 'like',
  regexp = 'regexp',
  startsWith = 'startsWith',
  endsWith = 'endsWith',
  contains = 'contains',
  arrayContains = 'arrayContains',
  exists = 'exists',
  notExists = 'notExists'
}

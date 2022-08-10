import { ObjectID } from 'bson'
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
  [key in LogicOperator]: key extends LogicOperator.in
    ? T[]
    : key extends LogicOperator.notIn
    ? T[]
    : T
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
  paginated?: Paginator
}

export type AddUndefinedIfNullable<T> = T extends null | undefined
  ? undefined
  : never

export type GetSelectedFromObject<
  T extends FluentQuery<Model>,
  Model,
  OutputDTO
> = {
  // Check nested objects
  // Is the selected key an object? A.K.A -> nested attribute
  [P in keyof T['select']]: T['select'][P] extends object
    ?
        | QueryOutput<
            { select: T['select'][P] },
            NonNullable<Model[P]>,
            OutputDTO[P]
          >
        | AddUndefinedIfNullable<Model[P]>
    : OutputDTO[P]
}

export type QueryOutput<
  T extends FluentQuery<Model>,
  Model,
  OutputDTO
> = T extends {
  select: T['select']
}
  ? T extends { paginated: T['paginated'] }
    ? PaginatedData<GetSelectedFromObject<T, Model, OutputDTO>>
    : GetSelectedFromObject<T, Model, OutputDTO>[]
  : // If it does not extend select
  T extends { paginated: T['paginated'] }
  ? PaginatedData<OutputDTO>
  : OutputDTO[]

export type SingleQueryOutput<
  T extends FluentQuery<Model>,
  Model,
  OutputDTO
> = T extends {
  select: T['select']
}
  ? T extends { paginated: T['paginated'] }
    ? PaginatedData<GetSelectedFromObject<T, Model, OutputDTO>>
    : GetSelectedFromObject<T, Model, OutputDTO>
  : // If it does not extend select
  T extends { paginated: T['paginated'] }
  ? PaginatedData<OutputDTO>
  : OutputDTO

export interface PaginatedData<T> {
  currentPage: number
  data: T[]
  firstPageUrl?: string
  nextPageUrl?: string
  prevPageUrl?: string
  path?: string
  perPage: number
  total: number
  lastPage: number
  firstPage: number
  nextPage: number
  prevPage: number | null
  from: number
  to: number
}

export interface Paginator {
  page: number
  perPage: number
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

export type FluentHasManyRelatedAttribute<T> = Partial<{
  [K in keyof Concrete<T>]: Concrete<T>[K] extends object
    ? Unpacked<Partial<FluentHasManyRelatedAttribute<Concrete<T>[K]>>> | boolean
    : boolean | undefined
}>

export type FluentHasManyParams<T extends FluentHasManyParams<T>> = {
  repository: new () => InstanceType<T['repository']>
}

export type FluentBelongsToParams<T extends FluentHasManyParams<T>> = {
  repository: new () => InstanceType<T['repository']>
}

export type FluentBelongsToManyParams<T extends FluentBelongsToManyParams<T>> =
  {
    repository: new () => InstanceType<T['repository']>
    pivot: new () => InstanceType<T['pivot']>
  }

export type FindByIdFilter<T> = {
  select?: FluentQuery<T>['select']
  include?: FluentQuery<T>['include']
  limit?: number
}

export type LoadedResult<T> = Omit<
  T,
  | 'findMany'
  | 'insert'
  | 'insertMany'
  | 'loadFirst'
  | 'byId'
  | 'replaceById'
  | 'updateById'
  | 'clear'
  | 'requireById'
  | 'collect'
  | 'findByIds'
  | 'findFirst'
  | 'isMongoDB'
  | 'pluck'
  | 'raw'
  | 'associate'
  | 'attach'
  | 'withPivot'
  | 'loadById'
>

export type QueryFieldSelector<T> = Partial<{
  [K in keyof Concrete<T>]: Concrete<T>[K] extends object
    ? true | Unpacked<Partial<QueryFieldSelector<Concrete<T>[K]>>>
    : true | undefined
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
    ? Unpacked<Partial<QueryWhereFitler<Concrete<T>[K]>>>
    : Unpacked<Partial<QueryOperations<Concrete<T>[K]>>> | T[K]
}>

export type QueryInsert<T> = {
  [K in keyof T]: T[K] extends object ? QueryInsert<T[K]> : T[K]
}

export type ModelRelation<T> = T

export type QueryIncludeRelation<T> = {
  [K in keyof Partial<T>]:
    | (FluentQuery<Unpacked<T[K]>> & { withPivot?: true })
    | true
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
  take?: number
  include?: QueryIncludeRelation<T>
  paginated?: Paginator
}

export type AddUndefinedIfNullable<T> = T extends null | undefined
  ? undefined
  : never

// TODO: We need to properly type the pivot tables
export type GetSelectedFromInclude<T extends FluentQuery<Model>, Model> = {
  // Check nested objects
  // Is the selected key an object? A.K.A -> nested attribute
  [P in keyof T['include']]: T['include'][P] extends object
    ? // We have to remove nullable to check for array!
      NonNullable<Model[P]> extends any[]
      ? T['include'][P] extends { withPivot: true }
        ? // Array with pivot
          | (QueryOutput<T['include'][P], Unpacked<NonNullable<Model[P]>>> & {
                pivot: AnyObject
              })[]
            | AddUndefinedIfNullable<Model[P]>
        : // Array without pivot
          | (QueryOutput<T['include'][P], Unpacked<NonNullable<Model[P]>>> & {
                pivot: AnyObject
              })[]
            | AddUndefinedIfNullable<Model[P]>
      : // Not an array
      T['include'][P] extends { withPivot: true }
      ? // Not an array an includes pivot
        | (QueryOutput<T['include'][P], Unpacked<NonNullable<Model[P]>>> & {
              pivot: AnyObject
            })
          | AddUndefinedIfNullable<Model[P]>
      : // Not an array an does not include pivot
        | QueryOutput<T['include'][P], Unpacked<NonNullable<Model[P]>>>
          | AddUndefinedIfNullable<Model[P]>
    : // If it does not extend object -> true, return the model
      Model[P]
}

export type GetSelectedFromObject<T extends FluentQuery<Model>, Model> = {
  // Check nested objects
  // Is the selected key an object? A.K.A -> nested attribute
  [P in keyof T['select']]: T['select'][P] extends object
    ? // We have to remove nullable to check for array!
      NonNullable<Model[P]> extends any[]
      ?
          | QueryOutput<
              { select: T['select'][P] },
              Unpacked<NonNullable<Model[P]>>
            >[]
          | AddUndefinedIfNullable<Model[P]>
      :
          | QueryOutput<
              { select: T['select'][P] },
              Unpacked<NonNullable<Model[P]>>
            >
          | AddUndefinedIfNullable<Model[P]>
    : // If it does not extend object -> true, return the model
      Model[P]
} & GetSelectedFromInclude<T, Model>

export type QueryOutput<
  T extends FluentQuery<Model>,
  Model
> = ExpandRecursively<
  T extends {
    select: T['select']
  }
    ? T extends { paginated: T['paginated'] }
      ? PaginatedData<GetSelectedFromObject<T, Model>>
      : ExpandRecursively<GetSelectedFromObject<T, Model>>
    : // If it does not extend select
    T extends { paginated: T['paginated'] }
    ? PaginatedData<Model>
    : Model & GetSelectedFromInclude<T, Model>
>

export interface Deleted {
  deleted: number
}

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
    ? Unpacked<Partial<FluentHasManyRelatedAttribute<Concrete<T>[K]>>> | true
    : true | undefined
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

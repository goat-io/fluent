import { ObjectID } from 'bson'

export interface BaseDataElement {
  id?: string
  _id?: string
  [key: string]: any
}

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

export interface Sure {
  sure: boolean
}

export interface Deleted {
  deleted: number
}

export type Primitives = boolean | string | number | ObjectID
export type PrimitivesArray = boolean[] | string[] | number[] | ObjectID[]

export type LogicOperator =
  | '='
  | '<'
  | '>'
  | '<='
  | '>='
  | '<>'
  | '!='
  | 'in'
  | 'nin'
  | 'like'
  | 'regexp'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'array-contains'

export type DaoOutput<Input, Output> = {id: string} & Input | {id: string} & Output

export type WhereClause = [string, LogicOperator, Primitives]

export type Filter = {
  fields?: string[]
  limit?: number
  offset?: number
  order?: {
    field: string
    asc?: boolean
    type?: 'string' | 'number' | 'date'
  }
  skip?: number
  where?: {
    and?: WhereClause[]
    or?: WhereClause[]
  }
}

type Cons<H, T> = T extends readonly any[]
  ? ((h: H, ...t: T) => void) extends (...r: infer R) => void
    ? R
    : never
  : never

type Prev = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  ...0[]
]

export type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?:
        | [K]
        | (Paths<T[K], Prev[D]> extends infer P
            ? P extends []
              ? never
              : Cons<K, P>
            : never)
    }[keyof T]
  : []

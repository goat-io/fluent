export interface IDataElement {
  id?: string
  [key: string]: any
}

export interface IPaginatedData<T> {
  current_page: number
  data: T[]
  first_page_url: string
  next_page_url: string
  prev_page_url: string
  path: string
  per_page: number
  total: number
}

export interface IPaginator {
  page: number
  perPage
}

export interface ISure {
  sure: boolean
}

export interface IDeleted {
  deleted: number
}

export type Primitives = boolean | string | number
export type PrimitivesArray = boolean[] | string[] | number[]

export interface IGoatExtendedAttributes {
  id: string
  created: string
  updated: string
  deleted?: string
  owner?: string
  _ngram?: string
  roles: string[]
}

export type OperatorType =
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

export type GoatOutput<Input, Output> = Partial<Input> &
  Partial<Output> &
  Partial<IGoatExtendedAttributes>

export type GoatWhere = [string, OperatorType, Primitives]

export type GoatFilter = {
  fields?: string[]
  // include:,
  limit?: number
  offset?: number
  order?: {
    field: string
    asc?: boolean
    type?: 'string' | 'number' | 'date'
  }
  skip?: number
  where?: {
    and?: GoatWhere[]
    or?: GoatWhere[]
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

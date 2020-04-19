export interface IPaginatedData {
  current_page: number
  data: any[]
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

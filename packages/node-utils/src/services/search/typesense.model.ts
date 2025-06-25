import type { Primitive } from '@goatlab/js-utils'

export type TypesenseFieldType =
  | 'string'
  | 'string[]'
  | 'int32'
  | 'int32[]'
  | 'int64'
  | 'int64[]'
  | 'float'
  | 'float[]'
  | 'bool'
  | 'bool[]'
  // Latitude and longitude specified as [lat, lng]
  | 'geopoint'
  | 'geopoint[]'
  // Special type that automatically converts values to a string or string[].
  | 'string*'
  | 'auto'
  | 'object'
  | 'object[]'

export interface TypesenseCollection {
  name: string
  alias?: string
  fields: {
    name: string
    type: TypesenseFieldType
    optional?: boolean
    facet?: boolean
    infix?: boolean
  }[]
  default_sorting_field?: string
  symbols_to_index?: string[]
  enable_nested_fields?: boolean
}

export type TypesenseCollectionOutput = TypesenseCollection & {
  num_documents: number
}

export type TypesenseDocument<T> = {
  id: string | number
} & T
export interface TypesenseDocumentGeneric {
  [key: string]: Primitive | Primitive[]
  id: string | number
}

// https://typesense.org/docs/0.23.1/api/search.html#query-parameters
export interface TypesenseQuery {
  q: string
  /**
   * String[] should be separated by comma
   */
  query_by: string
  filter_by?: string
  prefix?: string
  infix?: string
  split_join_tokens?: string
  pre_segmented_query?: string
  facet_by?: string
  max_facet_values?: number
  facet_query?: string
  facet_query_num_typos?: number

  /**
   * Pagination
   */
  page?: number
  per_page?: number
  group_by?: string
  group_limit?: number

  /**
   * Results
   */
  include_fields?: string
  exclude_fields?: string
  highlight_fields?: string
  highlight_full_fields?: string
  highlight_affix_num_tokens?: number
  // Default: <mark>
  highlight_start_tag?: string
  // Default: </mark>
  highlight_end_tag?: string
}

export interface TypesenseQueryResults<T> {
  facet_counts: []
  found: number
  out_of: number
  page: number
  request_params: {
    collection_name: string
    per_page: number
    q: string
  }
  search_time_ms: number
  hits: {
    document: TypesenseDocument<T>
    text_match: number
    highlights: {
      field: string
      snippet: string
      matched_tokens: string[]
    }[]
  }[]
}

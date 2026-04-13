import type { Primitive } from '@goatlab/js-utils'

/**
 * Enhanced error class for Typesense API errors with rate limit and response details
 */
export class TypesenseError extends Error {
  public readonly status: number
  public readonly statusText: string
  public readonly response?: any
  public readonly rateLimitRemaining?: number
  public readonly rateLimitReset?: Date
  public readonly retryAfter?: number
  public readonly rateLimitLimit?: number

  constructor(
    message: string,
    status: number,
    response?: any,
    headers?: Record<string, string>,
  ) {
    super(message)
    this.name = 'TypesenseError'
    this.status = status
    this.statusText = status.toString()
    this.response = response

    // Extract rate limit information from headers (Typesense format)
    if (headers) {
      const remaining = headers['X-RateLimit-Remaining']
      const resetMs = headers['X-RateLimit-ResetMs'] // Typesense uses milliseconds
      const retryAfter = headers['Retry-After']
      const limit = headers['X-RateLimit-Limit']

      if (remaining) {
        this.rateLimitRemaining = Number.parseInt(remaining, 10)
      }
      if (resetMs) {
        this.rateLimitReset = new Date(Number.parseInt(resetMs, 10))
      }
      if (retryAfter) {
        this.retryAfter = Number.parseInt(retryAfter, 10)
      }
      if (limit) {
        this.rateLimitLimit = Number.parseInt(limit, 10)
      }
    }
  }

  /**
   * Check if this error is due to rate limiting
   */
  isRateLimited(): boolean {
    return this.status === 429
  }

  /**
   * Get the time until rate limit reset (in milliseconds)
   */
  getTimeUntilReset(): number | null {
    if (!this.rateLimitReset) {
      return null
    }
    return Math.max(0, this.rateLimitReset.getTime() - Date.now())
  }
}

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

export interface TypesenseCollectionField {
  name: string
  type: TypesenseFieldType
  optional?: boolean
  facet?: boolean
  infix?: boolean
  sort?: boolean // Whether the field is sortable
  // Vector field properties (v29+)
  num_dim?: number // Number of dimensions for vector fields
  vec_dist?: 'cosine' | 'ip' | 'l2' // Distance metric for vector fields
  store?: boolean // Whether to store the vector values
  // Nested schema for object types
  schema?: TypesenseCollectionField[] // For nested object definitions
}

export interface TypesenseCollection {
  name: string
  alias?: string
  fields: TypesenseCollectionField[]
  default_sorting_field?: string
  symbols_to_index?: string[]
  enable_nested_fields?: boolean
}

export type TypesenseCollectionOutput = TypesenseCollection & {
  num_documents: number
}

export type TypesenseDocument<
  T extends Record<string, any> = Record<string, any>,
> = {
  id: string | number
} & T

/**
 * Constraint to ensure documents have required id field
 */
export type WithRequiredId<T> = T & { id: string | number }
export interface TypesenseDocumentGeneric {
  [key: string]: Primitive | Primitive[]
  id: string | number
}

// https://typesense.org/docs/27.0/api/search.html#query-parameters
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
   * Pagination - NOTE: Cannot be used with vector_query
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

  // Vector search parameters (v29+) - mutually exclusive with page/per_page
  vector_query?: string // Format: field_name:([vector_values],k:10)

  // Hybrid search parameters
  text_matches?: number // Minimum text matches required (must be ≤ per_page)
  vector_weight?: number // Weight for vector search (0-1)

  // Preset search
  preset?: string // Name of the preset to use
}

/**
 * Type-safe vector search query (cannot use pagination)
 */
export interface TypesenseVectorQuery
  extends Omit<TypesenseQuery, 'page' | 'per_page'> {
  vector_query: string
  vector_weight?: number
  text_matches?: number
}

/**
 * Type-safe text search query (can use pagination)
 */
export interface TypesenseTextQuery extends TypesenseQuery {
  vector_query?: never
  vector_weight?: never
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

// Import/Export types
export interface TypesenseImportOptions {
  /**
   * The import operation to perform
   * - create: Fails if a document with the same id already exists
   * - upsert: Creates a new document or updates an existing document if one with the same id already exists
   * - update: Updates an existing document. Fails if the document doesn't exist
   * - emplace: Creates a new document if one with the same id doesn't exist. Does nothing if the document already exists
   * @default 'create'
   */
  action?: 'create' | 'upsert' | 'update' | 'emplace'
  /**
   * Number of documents to send in each batch
   * @default 40
   */
  batch_size?: number
  /**
   * If set to true, the response will contain the id of the imported documents
   * @default false
   */
  return_id?: boolean
  /**
   * If set to true, the response will contain the actual imported documents
   * @default false
   */
  return_doc?: boolean
  /**
   * If set to true, skips indexing and stores the documents directly on disk. Indexing is done in background.
   * Useful when you have a large number of documents to import and want to reduce memory usage during import.
   * @default false
   */
  dirty_values?: 'coerce_or_reject' | 'coerce_or_drop' | 'drop' | 'reject'
  /**
   * The format of the import data
   * @default 'jsonl'
   */
  format?: TypesenseImportFormat
}

export interface TypesenseImportResult {
  success: boolean
  error?: string
  document?: any
  id?: string | number
}

export interface TypesenseExportOptions {
  /**
   * Filter documents by a condition. Uses the same syntax as search filter_by
   */
  filter_by?: string
  /**
   * List of fields to include in the exported documents
   */
  include_fields?: string
  /**
   * List of fields to exclude from the exported documents
   */
  exclude_fields?: string
  /**
   * Compression format for the export
   */
  compression?: 'gzip' | 'none'
  /**
   * Collection override for multi-tenancy
   */
  collection?: string
}

export type TypesenseImportFormat = 'jsonl' | 'json' | 'csv'
export type TypesenseExportFormat = 'jsonl' | 'json' | 'csv'

/**
 * Health check response from Typesense
 */
export interface TypesenseHealthResponse {
  ok: boolean
}

/**
 * Generic response wrapper for Typesense operations with metadata
 */
export interface TypesenseResponse<T> {
  /**
   * The actual data returned by the operation
   */
  data: T
  /**
   * Operation metadata
   */
  metadata: {
    /**
     * Time taken for the operation in milliseconds
     */
    operation_time_ms?: number
    /**
     * Number of documents found (for search operations)
     */
    found?: number
    /**
     * Total documents that match without pagination (for search operations)
     */
    out_of?: number
    /**
     * Search time in milliseconds (for search operations)
     */
    search_time_ms?: number
    /**
     * Facet counts (for search operations with facets)
     */
    facet_counts?: any[]
    /**
     * Number of documents in collection (for collection operations)
     */
    num_documents?: number
    /**
     * Request parameters used (for search operations)
     */
    request_params?: Record<string, any>
    /**
     * Operation type for clarity
     */
    operation:
      | 'create'
      | 'update'
      | 'delete'
      | 'upsert'
      | 'get'
      | 'search'
      | 'import'
      | 'export'
  }
}

/**
 * Type guard to check if a value is a valid document ID
 */
export function isValidDocumentId(id: any): id is string | number {
  return (
    (typeof id === 'string' && id.length > 0) ||
    (typeof id === 'number' && !Number.isNaN(id))
  )
}

/**
 * Validates text_matches parameter against per_page
 */
export function validateTextMatches(
  textMatches: number,
  perPage: number,
): boolean {
  return textMatches <= perPage
}

/**
 * Validates vector search parameters
 */
export function validateVectorQuery(query: TypesenseQuery): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (query.vector_query) {
    // Vector queries cannot use pagination
    if (query.page !== undefined || query.per_page !== undefined) {
      errors.push(
        'vector_query cannot be used with page or per_page parameters',
      )
    }

    // Validate text_matches if present
    if (
      query.text_matches &&
      query.per_page &&
      query.text_matches > query.per_page
    ) {
      errors.push('text_matches must be less than or equal to per_page')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Error thrown when client is destroyed
 */
export class ClientDestroyedError extends Error {
  constructor() {
    super('TypesenseApi has been destroyed and cannot be used')
    this.name = 'ClientDestroyedError'
  }
}

// Multi-search types
export interface TypesenseMultiSearchQuery {
  collection?: string
  q: string
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
  page?: number
  per_page?: number
  group_by?: string
  group_limit?: number
  include_fields?: string
  exclude_fields?: string
  highlight_fields?: string
  highlight_full_fields?: string
  highlight_affix_num_tokens?: number
  highlight_start_tag?: string
  highlight_end_tag?: string
}

export interface TypesenseMultiSearchRequest {
  searches: TypesenseMultiSearchQuery[]
}

export interface TypesenseMultiSearchResult<T> {
  results: Array<TypesenseQueryResults<T> & { request_params: any }>
}

// Delete by filter types
export interface TypesenseDeleteByFilterOptions {
  filter_by: string
  batch_size?: number
}

// Alias types
export interface TypesenseAlias {
  name: string
  collection_name: string
}

export interface TypesenseAliasCreateRequest {
  collection_name: string
}

export interface TypesenseAliasResponse extends TypesenseAlias {
  // Additional fields that might be returned by the API
}

export interface TypesenseAliasListResponse {
  aliases: TypesenseAliasResponse[]
}

// Stats types
export interface TypesenseCollectionStats {
  collection_name: string
  num_documents: number
  // Add more stats fields as per Typesense v29 API
  created_at: number
  num_memory_shards: number
  num_documents_indexed: number
  num_documents_queued: number
  field_stats?: {
    [fieldName: string]: {
      num_values: number
      avg_length?: number
      min?: number
      max?: number
    }
  }
}

// Cluster status types
export interface TypesenseClusterNode {
  id: string
  name: string
  state: 'ALIVE' | 'UNAVAILABLE' | 'INACTIVE'
  last_contact: number
}

export interface TypesenseClusterStatus {
  state: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'
  nodes: TypesenseClusterNode[]
}

// Synonym types
export interface TypesenseSynonym {
  id?: string
  synonyms: string[] // Array of synonymous terms
  root?: string // Optional root word for one-way synonyms
}

export interface TypesenseSynonymResponse extends TypesenseSynonym {
  id: string
}

// Override types
export interface TypesenseOverride {
  id?: string
  rule: {
    query: string // Exact query match
    match: 'exact' | 'contains' // Match type
  }
  // Document IDs to include/exclude
  includes?: Array<{ id: string; position: number }>
  excludes?: Array<{ id: string }>
  // Optional filter
  filter_by?: string
  // Optional custom curation
  remove_matched_tokens?: boolean
  stop_processing?: boolean
}

export interface TypesenseOverrideResponse extends TypesenseOverride {
  id: string
}

// Preset types
export interface TypesensePreset {
  name: string
  value: {
    // Any valid search parameters
    filter_by?: string
    sort_by?: string
    facet_by?: string
    max_facet_values?: number
    group_by?: string
    group_limit?: number
    include_fields?: string
    exclude_fields?: string
    highlight_fields?: string
    // ... other search params
  }
}

export interface TypesensePresetResponse extends TypesensePreset {
  // Additional fields returned by API
}

// Health/Metrics types
export interface TypesenseHealth {
  ok: boolean
}

export interface TypesenseMetrics {
  // System metrics
  system_cpu_active_percentage: string
  system_disk_total_bytes: string
  system_disk_used_bytes: string
  system_memory_total_bytes: string
  system_memory_used_bytes: string
  system_network_received_bytes: string
  system_network_sent_bytes: string

  // Typesense metrics
  typesense_memory_active_bytes: string
  typesense_memory_allocated_bytes: string
  typesense_memory_fragmentation_ratio: string
  typesense_memory_mapped_bytes: string
  typesense_memory_metadata_bytes: string
  typesense_memory_resident_bytes: string
  typesense_memory_retained_bytes: string

  // Request metrics
  latency_ms?: Record<string, Record<string, number>>
  requests_per_second?: Record<string, number>
}

// Operations API types
export interface TypesenseOperation {
  id: number
  name: string
  status: 'success' | 'failure' | 'processing'
  resource_id?: string
  resource_type?: string
  started_at: number
  completed_at?: number
  details?: Record<string, any>
}

// Keys API types
export interface TypesenseApiKey {
  id?: number
  value?: string
  description: string
  actions: string[]
  collections: string[]
  expires_at?: number
}

export interface TypesenseApiKeyResponse extends TypesenseApiKey {
  id: number
  value_prefix: string
}

// Rate limit information exposed in responses (Typesense format)
export interface TypesenseRateLimitInfo {
  limit?: number // X-RateLimit-Limit
  remaining?: number // X-RateLimit-Remaining
  resetMs?: number // X-RateLimit-ResetMs (milliseconds since epoch)
  retryAfter?: number // Retry-After (seconds)
}

// Enhanced search options for vector/hybrid search
export interface TypesenseVectorSearchOptions {
  vector_query: string
  vector_weight?: number
  text_matches?: number
}

export interface TypesenseHybridSearchOptions {
  vector_weight: number
  text_matches?: number
}

// Multi-tenancy options
export interface TypesenseCollectionOptions {
  collection?: string
}

// Schema cache for auto-create functionality
export interface TypesenseSchemaCacheEntry {
  schema: TypesenseCollection
  timestamp: number
}

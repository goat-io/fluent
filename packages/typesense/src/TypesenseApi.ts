// Collections

import { getCollectionStats } from './actions/admin/getCollectionStats'
// Admin
import { health, waitForHealth } from './actions/admin/health'
import { getMetrics, getStats } from './actions/admin/metrics'
// Aliases
import { createOrUpdateAlias } from './actions/aliases/createOrUpdateAlias'
import { deleteAlias } from './actions/aliases/deleteAlias'
import { getAlias } from './actions/aliases/getAlias'
import { listAliases } from './actions/aliases/listAliases'
import { createCollection } from './actions/collections/createCollection'
import { deleteCollection } from './actions/collections/deleteCollection'
import { getCollection } from './actions/collections/getCollection'
import { getOrCreateCollection } from './actions/collections/getOrCreateCollection'
import { listCollections } from './actions/collections/listCollections'
import { updateCollection } from './actions/collections/updateCollection'
import { clearCollection } from './actions/documents/clearCollection'
import { deleteByFilter } from './actions/documents/deleteByFilter'
import { deleteDocument } from './actions/documents/deleteDocument'
import {
  exportDocuments,
  exportDocumentsStream
} from './actions/documents/exportDocuments'
import { getDocumentById } from './actions/documents/getDocumentById'
import { importDocuments } from './actions/documents/importDocuments'
// Documents
import { insertDocument } from './actions/documents/insertDocument'
import { updateDocument } from './actions/documents/updateDocument'
import { upsertDocument } from './actions/documents/upsertDocument'
import { deleteOverride } from './actions/overrides/deleteOverride'
import { getOverride } from './actions/overrides/getOverride'
import { listOverrides } from './actions/overrides/listOverrides'
// Overrides
import { upsertOverride } from './actions/overrides/upsertOverride'
import { deletePreset } from './actions/presets/deletePreset'
import { getPreset } from './actions/presets/getPreset'
import { listPresets } from './actions/presets/listPresets'
// Presets
import { upsertPreset } from './actions/presets/upsertPreset'
import { multiSearch } from './actions/search/multiSearch'
// Search
import { search, searchText, searchVector } from './actions/search/search'
import { deleteSynonym } from './actions/synonyms/deleteSynonym'
import { getSynonym } from './actions/synonyms/getSynonym'
import { listSynonyms } from './actions/synonyms/listSynonyms'
// Synonyms
import { upsertSynonym } from './actions/synonyms/upsertSynonym'
import {
  type HttpClientOptions,
  TypesenseHttpClient
} from './components/http-client'
import {
  ResiliencePolicy,
  type ResiliencePolicyOptions
} from './components/resilience-policy'
import { CollectionSchemaManager } from './components/schema-manager'
// Types
import type { TypesenseContext } from './types'
import type {
  TypesenseCollection,
  TypesenseCollectionOptions,
  TypesenseDocument,
  TypesenseRateLimitInfo,
  WithRequiredId
} from './typesense.model'
import { defineCollection as defineCollectionUtil } from './utils/schema-to-types'
import { createSchemaTypedApi as createSchemaTypedApiUtil } from './utils/schema-typed-api'
import { createFQCN, sanitizeTenantId } from './utils/tenant'

export interface TypesenseApiOptions
  extends Omit<HttpClientOptions, 'prefixUrl' | 'token'> {
  prefixUrl: string
  token: string
  tenantId?: string
  collectionName?: string
  suppressLogs?: boolean
  appName?: string
  appVersion?: string
  autoCreateCollection?: boolean
  enableVersionCheck?: boolean
  schemaCacheSize?: number
  schemaCacheTtl?: number
  resilience?: ResiliencePolicyOptions
  typesenseVersion?: string
  // Observability callbacks
  onCircuitBreakerStateChange?: (
    state: 'open' | 'closed' | 'half-open',
    metadata?: any
  ) => void
  onRateLimitUpdate?: (info: TypesenseRateLimitInfo) => void
}

/**
 * Type helper to extract tail parameters after context
 */
type Tail<F> = F extends (ctx: any, ...rest: infer R) => any ? R : never

/**
 * Binds context to API functions by prepending context as first argument
 * Preserves generic types through currying
 */
function bindCtx<Ctx extends object>(ctx: Ctx) {
  return <F extends (ctx: Ctx, ...args: any[]) => any>(fn: F) =>
    (...args: Tail<F>) =>
      fn(ctx, ...args)
}

/**
 * Modern, modular Typesense API client with grouped functionality
 *
 * @example
 * ```typescript
 * const api = new TypesenseApi({
 *   prefixUrl: 'http://localhost:8108',
 *   token: 'xyz',
 *   collectionName: 'products'
 * })
 *
 * // Collections
 * await api.collections.create({ name: 'products', fields: [...] })
 * await api.collections.getOrCreate({ name: 'products', fields: [...] })
 *
 * // Documents
 * await api.documents.insert({ id: '1', title: 'Product 1' })
 * await api.documents.search({ q: 'product', query_by: 'title' })
 *
 * // Admin
 * await api.admin.health()
 * await api.admin.getMetrics()
 * ```
 */
/**
 * Factory helper for creating typed TypesenseApi instances
 * @example
 * ```typescript
 * interface Product { id: string; title: string; price: number; }
 * const productApi = createTypedApi<Product>()({
 *   prefixUrl: 'http://localhost:8108',
 *   token: 'xyz',
 *   collectionName: 'products'
 * })
 *
 * // Now all document operations are typed
 * await productApi.documents.insert({ id: "1", title: "Foo", price: 42 }) // ✅ typed
 * ```
 */
export const createTypedApi =
  <TDoc extends Record<string, any>>() =>
  (options: TypesenseApiOptions) =>
    new TypesenseApi<TDoc>(options)

/**
 * Type-safe multitenant API wrapper
 */
export type TenantApi<TDoc, TenantId extends string> = TypesenseApi<TDoc> & {
  readonly tenantId: TenantId
}

export class TypesenseApi<
  TDoc extends Record<string, any> = Record<string, any>
> {
  private readonly ctx: TypesenseContext<TDoc>
  private withCtx!: ReturnType<typeof bindCtx<TypesenseContext<TDoc>>>
  private readonly options: TypesenseApiOptions

  // Expose components for advanced usage
  readonly httpClient: TypesenseHttpClient
  readonly resilience: ResiliencePolicy
  readonly schemaManager: CollectionSchemaManager

  /**
   * Define a strongly-typed collection schema
   * @example
   * ```typescript
   * const ProductCollection = TypesenseApi.defineCollection({
   *   name: 'products',
   *   fields: [
   *     { name: 'id', type: 'string' as const },
   *     { name: 'title', type: 'string' as const },
   *     { name: 'price', type: 'float' as const },
   *     { name: 'inStock', type: 'bool' as const }
   *   ] as const
   * } as const)
   * ```
   */
  static defineCollection = defineCollectionUtil

  /**
   * Create a strongly-typed API instance from a collection schema
   * @example
   * ```typescript
   * const ProductCollection = TypesenseApi.defineCollection({...})
   *
   * const api = TypesenseApi.createSchemaTypedApi(ProductCollection)({
   *   prefixUrl: 'http://localhost:8108',
   *   token: 'xyz'
   * })
   *
   * // Now all document operations are fully typed
   * await api.documents.insert({
   *   id: '1',
   *   title: 'Product',
   *   price: 99.99,
   *   inStock: true
   * })
   * ```
   */
  static createSchemaTypedApi = createSchemaTypedApiUtil

  /**
   * Create a typed API from an inline collection definition (convenience method)
   * @example
   * ```typescript
   * const api = TypesenseApi.createFromSchema({
   *   name: 'products',
   *   fields: [
   *     { name: 'id', type: 'string' as const },
   *     { name: 'title', type: 'string' as const },
   *     { name: 'price', type: 'float' as const }
   *   ] as const
   * } as const)({
   *   prefixUrl: 'http://localhost:8108',
   *   token: 'xyz'
   * })
   * ```
   */
  static createFromSchema<const C extends TypesenseCollection>(collection: C) {
    return TypesenseApi.createSchemaTypedApi(
      TypesenseApi.defineCollection(collection)
    )
  }

  constructor(options: TypesenseApiOptions) {
    this.options = options

    // Initialize resilience policy with observability callbacks
    this.resilience = new ResiliencePolicy({
      ...options.resilience,
      onStateChange: options.onCircuitBreakerStateChange,
      onRateLimitUpdate: options.onRateLimitUpdate
    })

    // Create request/response interceptors for circuit breaker
    const beforeRequestHooks = [
      async (_request: Request) => {
        // Check circuit breaker before making request
        if (this.resilience.isCircuitOpen()) {
          const error = new Error(
            'Circuit breaker is open - service unavailable'
          )
          ;(error as any).isCircuitBreakerError = true
          ;(error as any).retriesRemaining = 0
          throw error
        }
        return undefined
      },
      ...(options.beforeRequest || [])
    ]

    const afterResponseHooks = [
      async (_request: Request, _options: any, response: Response) => {
        // Only record success for successful responses
        if (response.ok) {
          this.resilience.recordSuccess()
        }
        // Update rate limit info
        this.resilience.updateRateLimit(response.headers)
        return response
      },
      ...(options.afterResponse || [])
    ]

    const beforeErrorHooks = [
      (error: any) => {
        // Record failure for circuit breaker before any error transformation
        this.resilience.recordFailure()

        // Check if circuit is now open after recording failure
        if (this.resilience.isCircuitOpen()) {
          // Replace the error with circuit breaker error
          const circuitError = new Error('Circuit breaker is open')
          ;(circuitError as any).isCircuitBreakerError = true
          throw circuitError
        }

        // Re-throw the original error
        throw error
      }
    ]

    // Initialize components with interceptors
    this.httpClient = new TypesenseHttpClient({
      prefixUrl: options.prefixUrl,
      token: options.token,
      searchTimeout: options.searchTimeout,
      importTimeout: options.importTimeout,
      defaultTimeout: options.defaultTimeout,
      beforeRequest: beforeRequestHooks,
      afterResponse: afterResponseHooks,
      beforeError: beforeErrorHooks,
      kyInstance: options.kyInstance,
      enforceTLS: options.enforceTLS
    })

    this.schemaManager = new CollectionSchemaManager({
      typesenseVersion: options.typesenseVersion,
      cacheSize: options.schemaCacheSize,
      cacheTtl: options.schemaCacheTtl,
      suppressLogs: options.suppressLogs
    })

    // Validate and sanitize tenant ID if provided
    const sanitizedTenantId = options.tenantId
      ? sanitizeTenantId(options.tenantId)
      : undefined

    // Create context
    this.ctx = {
      httpClient: this.httpClient,
      resilience: this.resilience,
      schemaManager: this.schemaManager,
      tenantId: sanitizedTenantId,
      collectionName: options.collectionName || 'documents',
      typesenseVersion: options.typesenseVersion,
      autoCreateCollection: options.autoCreateCollection,
      suppressLogs: options.suppressLogs,
      fqcn: (baseCollectionName?: string) => {
        const base = baseCollectionName || this.ctx.collectionName
        return sanitizedTenantId ? createFQCN(sanitizedTenantId, base) : base
      }
    }

    this.withCtx = bindCtx(this.ctx)

    // Check version if enabled
    if (options.enableVersionCheck) {
      this.checkVersion()
    }
  }

  private async checkVersion(): Promise<void> {
    try {
      const stats = await this.admin.getStats()
      if (stats.server_version) {
        this.ctx.typesenseVersion = stats.server_version
        this.schemaManager.setTypesenseVersion(stats.server_version)

        if (!this.options.suppressLogs) {
          console.info(`Connected to Typesense v${stats.server_version}`)
        }
      }
    } catch (_error) {
      // Version check is optional, continue silently
    }
  }

  /**
   * Collection management operations
   */
  get collections() {
    return {
      create: this.withCtx(createCollection),
      get: this.withCtx(getCollection),
      update: this.withCtx(updateCollection),
      delete: this.withCtx(deleteCollection),
      list: this.withCtx(listCollections),
      getOrCreate: this.withCtx(getOrCreateCollection)
    }
  }

  /**
   * Document CRUD operations
   */
  get documents() {
    const ctx = this.ctx
    return {
      insert: (
        document: WithRequiredId<TDoc>,
        options?: TypesenseCollectionOptions
      ) => insertDocument(ctx, document, options),
      upsert: (
        document: WithRequiredId<TDoc>,
        options?: TypesenseCollectionOptions
      ) => upsertDocument(ctx, document, options),
      update: (
        document: Partial<TypesenseDocument<TDoc>> & { id: string | number },
        options?: TypesenseCollectionOptions
      ) => updateDocument(ctx, document, options),
      delete: this.withCtx(deleteDocument),
      getById: this.withCtx(getDocumentById),
      import: this.withCtx(importDocuments),
      export: this.withCtx(exportDocuments),
      exportStream: this.withCtx(exportDocumentsStream),
      deleteByFilter: this.withCtx(deleteByFilter),
      clear: this.withCtx(clearCollection),

      // Search operations
      search: this.withCtx(search),
      searchText: this.withCtx(searchText),
      searchVector: this.withCtx(searchVector)
    }
  }

  /**
   * Search operations (alias for documents.search*)
   */
  get search() {
    return {
      query: this.withCtx(search),
      text: this.withCtx(searchText),
      vector: this.withCtx(searchVector),
      multi: this.withCtx(multiSearch)
    }
  }

  /**
   * Admin operations
   */
  get admin() {
    return {
      health: this.withCtx(health),
      waitForHealth: this.withCtx(waitForHealth),
      getMetrics: this.withCtx(getMetrics),
      getStats: this.withCtx(getStats),
      getCollectionStats: this.withCtx(getCollectionStats)
    }
  }

  /**
   * Alias management (v29+)
   */
  get aliases() {
    return {
      createOrUpdate: this.withCtx(createOrUpdateAlias),
      get: this.withCtx(getAlias),
      list: this.withCtx(listAliases),
      delete: this.withCtx(deleteAlias)
    }
  }

  /**
   * Synonym management (v29+)
   */
  get synonyms() {
    return {
      upsert: this.withCtx(upsertSynonym),
      get: this.withCtx(getSynonym),
      list: this.withCtx(listSynonyms),
      delete: this.withCtx(deleteSynonym)
    }
  }

  /**
   * Search override management (v29+)
   */
  get overrides() {
    return {
      upsert: this.withCtx(upsertOverride),
      get: this.withCtx(getOverride),
      list: this.withCtx(listOverrides),
      delete: this.withCtx(deleteOverride)
    }
  }

  /**
   * Preset management (v29+)
   */
  get presets() {
    return {
      upsert: this.withCtx(upsertPreset),
      get: this.withCtx(getPreset),
      list: this.withCtx(listPresets),
      delete: this.withCtx(deletePreset)
    }
  }

  /**
   * Get current resilience status
   */
  getResilienceStatus() {
    return this.resilience.getStatus()
  }

  /**
   * Get current rate limit info
   */
  getRateLimit() {
    return this.resilience.getRateLimit()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.schemaManager.getCacheStats()
  }

  /**
   * Get client version
   */
  getVersion() {
    return this.options.appVersion || '1.0.0'
  }

  /**
   * Get Typesense server version
   */
  getTypesenseVersion() {
    return this.ctx.typesenseVersion || 'unknown'
  }

  /**
   * Admin helper: List all collections for the current tenant
   * Returns only collections that belong to the configured tenant
   */
  async listTenantCollections(): Promise<string[]> {
    if (!this.ctx.tenantId) {
      throw new Error('Tenant ID is required for listing tenant collections')
    }

    const allCollections = await this.collections.list()
    const tenantPrefix = `${this.ctx.tenantId}__`

    return allCollections
      .map(c => c.name)
      .filter(name => name.startsWith(tenantPrefix))
  }

  /**
   * Admin helper: Get base collection names for the current tenant
   * Returns collection names without the tenant prefix
   */
  async listTenantBaseCollectionNames(): Promise<string[]> {
    const tenantCollections = await this.listTenantCollections()
    const tenantPrefix = `${this.ctx.tenantId}__`

    return tenantCollections.map(name => name.substring(tenantPrefix.length))
  }

  /**
   * Admin helper: Delete all collections for the current tenant
   * Use with caution - this will permanently delete all tenant data
   */
  async deleteAllTenantCollections(): Promise<void> {
    if (!this.ctx.tenantId) {
      throw new Error('Tenant ID is required for deleting tenant collections')
    }

    const tenantCollections = await this.listTenantCollections()

    for (const collectionName of tenantCollections) {
      await this.httpClient.request(`/collections/${collectionName}`, {
        method: 'DELETE'
      })
    }
  }

  /**
   * Admin helper: Check if a collection exists for the current tenant
   */
  async tenantCollectionExists(baseCollectionName?: string): Promise<boolean> {
    try {
      const collectionName = this.ctx.fqcn(baseCollectionName)
      await this.collections.get(collectionName)
      return true
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    this.schemaManager.clearCache()
    this.resilience.reset()
  }
}

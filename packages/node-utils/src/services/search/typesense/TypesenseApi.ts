// Collections
import { createCollection } from './actions/collections/createCollection'
import { getCollection } from './actions/collections/getCollection'
import { updateCollection } from './actions/collections/updateCollection'
import { deleteCollection } from './actions/collections/deleteCollection'
import { listCollections } from './actions/collections/listCollections'
import { getOrCreateCollection } from './actions/collections/getOrCreateCollection'

// Documents
import { insertDocument } from './actions/documents/insertDocument'
import { upsertDocument } from './actions/documents/upsertDocument'
import { updateDocument } from './actions/documents/updateDocument'
import { deleteDocument } from './actions/documents/deleteDocument'
import { getDocumentById } from './actions/documents/getDocumentById'
import { importDocuments } from './actions/documents/importDocuments'
import { exportDocuments, exportDocumentsStream } from './actions/documents/exportDocuments'
import { deleteByFilter } from './actions/documents/deleteByFilter'
import { clearCollection } from './actions/documents/clearCollection'

// Search
import { search, searchText, searchVector } from './actions/search/search'
import { multiSearch } from './actions/search/multiSearch'

// Admin
import { health, waitForHealth } from './actions/admin/health'
import { getMetrics, getStats } from './actions/admin/metrics'
import { getCollectionStats } from './actions/admin/getCollectionStats'

// Aliases
import { createOrUpdateAlias } from './actions/aliases/createOrUpdateAlias'
import { getAlias } from './actions/aliases/getAlias'
import { listAliases } from './actions/aliases/listAliases'
import { deleteAlias } from './actions/aliases/deleteAlias'

// Synonyms
import { upsertSynonym } from './actions/synonyms/upsertSynonym'
import { getSynonym } from './actions/synonyms/getSynonym'
import { listSynonyms } from './actions/synonyms/listSynonyms'
import { deleteSynonym } from './actions/synonyms/deleteSynonym'

// Overrides
import { upsertOverride } from './actions/overrides/upsertOverride'
import { getOverride } from './actions/overrides/getOverride'
import { listOverrides } from './actions/overrides/listOverrides'
import { deleteOverride } from './actions/overrides/deleteOverride'

// Presets
import { upsertPreset } from './actions/presets/upsertPreset'
import { getPreset } from './actions/presets/getPreset'
import { listPresets } from './actions/presets/listPresets'
import { deletePreset } from './actions/presets/deletePreset'

// Types
import type { TypesenseContext } from './types'
import { TypesenseHttpClient, type HttpClientOptions } from './components/http-client'
import { ResiliencePolicy, type ResiliencePolicyOptions } from './components/resilience-policy'
import { CollectionSchemaManager } from './components/schema-manager'

interface TypesenseApiOptions extends Omit<HttpClientOptions, 'prefixUrl' | 'token'> {
  prefixUrl: string
  token: string
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
}

/**
 * Binds context to API functions by prepending context as first argument
 */
function bindCtx<Ctx extends object>(ctx: Ctx) {
  return <F extends (ctx: Ctx, ...args: any[]) => any>(fn: F) => {
    return (...args: Parameters<F> extends [Ctx, ...infer Rest] ? Rest : never) => 
      fn(ctx, ...args as any)
  }
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
export class TypesenseApi<T extends Record<string, any> = Record<string, any>> {
  private readonly ctx: TypesenseContext
  private withCtx!: ReturnType<typeof bindCtx<TypesenseContext>>
  private readonly options: TypesenseApiOptions

  // Expose components for advanced usage
  readonly httpClient: TypesenseHttpClient
  readonly resilience: ResiliencePolicy
  readonly schemaManager: CollectionSchemaManager

  constructor(options: TypesenseApiOptions) {
    this.options = options
    
    // Initialize components
    this.httpClient = new TypesenseHttpClient({
      prefixUrl: options.prefixUrl,
      token: options.token,
      searchTimeout: options.searchTimeout,
      importTimeout: options.importTimeout,
      defaultTimeout: options.defaultTimeout,
      beforeRequest: options.beforeRequest,
      afterResponse: options.afterResponse,
      kyInstance: options.kyInstance,
      enforceTLS: options.enforceTLS
    })

    this.resilience = new ResiliencePolicy(options.resilience)
    
    this.schemaManager = new CollectionSchemaManager({
      typesenseVersion: options.typesenseVersion,
      cacheSize: options.schemaCacheSize,
      cacheTtl: options.schemaCacheTtl,
      suppressLogs: options.suppressLogs
    })

    // Create context
    this.ctx = {
      httpClient: this.httpClient,
      resilience: this.resilience,
      schemaManager: this.schemaManager,
      collectionName: options.collectionName || 'documents',
      typesenseVersion: options.typesenseVersion,
      autoCreateCollection: options.autoCreateCollection,
      suppressLogs: options.suppressLogs
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
    } catch (error) {
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
    return {
      insert: this.withCtx(insertDocument),
      upsert: this.withCtx(upsertDocument),
      update: this.withCtx(updateDocument),
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
   * Destroy the client and clean up resources
   */
  destroy() {
    this.schemaManager.clearCache()
    this.resilience.reset()
  }
}

// Export all action functions for direct usage if needed
export * from './actions/collections/createCollection'
export * from './actions/collections/getCollection'
export * from './actions/collections/updateCollection'
export * from './actions/collections/deleteCollection'
export * from './actions/collections/listCollections'
export * from './actions/collections/getOrCreateCollection'

export * from './actions/documents/insertDocument'
export * from './actions/documents/upsertDocument'
export * from './actions/documents/updateDocument'
export * from './actions/documents/deleteDocument'
export * from './actions/documents/getDocumentById'
export * from './actions/documents/importDocuments'
export * from './actions/documents/exportDocuments'
export * from './actions/documents/deleteByFilter'
export * from './actions/documents/clearCollection'

export * from './actions/search/search'
export * from './actions/search/multiSearch'

export * from './actions/admin/health'
export * from './actions/admin/metrics'
export * from './actions/admin/getCollectionStats'

export * from './actions/aliases/createOrUpdateAlias'
export * from './actions/aliases/getAlias'
export * from './actions/aliases/listAliases'
export * from './actions/aliases/deleteAlias'

export * from './actions/synonyms/upsertSynonym'
export * from './actions/synonyms/getSynonym'
export * from './actions/synonyms/listSynonyms'
export * from './actions/synonyms/deleteSynonym'

export * from './actions/overrides/upsertOverride'
export * from './actions/overrides/getOverride'
export * from './actions/overrides/listOverrides'
export * from './actions/overrides/deleteOverride'

export * from './actions/presets/upsertPreset'
export * from './actions/presets/getPreset'
export * from './actions/presets/listPresets'
export * from './actions/presets/deletePreset'
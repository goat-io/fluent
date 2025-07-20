// npx vitest run ./src/services/search/typesense.service.test.ts

import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { TypesenseApi } from './TypesenseApi'
import {
  isValidDocumentId,
  validateVectorQuery,
  validateTextMatches,
  ClientDestroyedError,
  TypesenseError,
  type TypesenseCollection,
  type TypesenseCollectionOutput,
  type TypesenseDocument,
  type TypesenseQuery,
  type TypesenseVectorQuery,
  type TypesenseTextQuery,
  type TypesenseQueryResults,
  type TypesenseImportOptions,
  type TypesenseImportResult,
  type TypesenseExportOptions,
  type TypesenseImportFormat,
  type TypesenseExportFormat,
  type TypesenseMultiSearchQuery,
  type TypesenseMultiSearchRequest,
  type TypesenseMultiSearchResult,
  type TypesenseDeleteByFilterOptions,
  type TypesenseAliasResponse,
  type TypesenseAliasListResponse,
  type TypesenseCollectionStats,
  type TypesenseClusterStatus,
  type TypesenseSynonym,
  type TypesenseSynonymResponse,
  type TypesenseOverride,
  type TypesenseOverrideResponse,
  type TypesensePreset,
  type TypesensePresetResponse,
  type TypesenseHealth,
  type TypesenseMetrics,
  type TypesenseRateLimitInfo,
  type TypesenseVectorSearchOptions,
  type TypesenseHybridSearchOptions,
  type TypesenseCollectionOptions,
  type WithRequiredId
} from './typesense.model'

interface TypesenseServiceOptions {
  prefixUrl: string
  token: string
  collectionName: string
  suppressLogs?: boolean
  appName?: string
  appVersion?: string
  autoCreateCollection?: boolean
  enableVersionCheck?: boolean
  schemaCacheSize?: number
  schemaCacheTtl?: number
  resilience?: any
  typesenseVersion?: string
  searchTimeout?: number
  importTimeout?: number
  defaultTimeout?: number
  beforeRequest?: any
  afterResponse?: any
  kyInstance?: any
  enforceTLS?: boolean
}

/**
 * TypesenseService - Backward compatibility wrapper around the new modular TypesenseApi
 * 
 * @deprecated Use TypesenseApi directly for new projects
 */
export class TypesenseService<T extends Record<string, any> = Record<string, any>> {
  private readonly api: TypesenseApi<T>
  private readonly collectionName: string
  private destroyed = false

  // Expose components for compatibility
  get httpClient() { return this.api.httpClient }
  get resilience() { return this.api.resilience }
  get schemaManager() { return this.api.schemaManager }

  constructor(options: TypesenseServiceOptions) {
    this.collectionName = options.collectionName
    this.api = new TypesenseApi<T>(options)
  }

  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new ClientDestroyedError()
    }
  }

  private async wrapCall<R>(operation: () => Promise<R>, operationName: string): Promise<R> {
    this.checkDestroyed()
    
    if (this.api.resilience.isCircuitOpen()) {
      throw new TypesenseError('Circuit breaker is open', 503)
    }

    let lastError: any
    let retryCount = 0
    const maxRetries = 3

    while (retryCount <= maxRetries) {
      try {
        const result = await operation()
        this.api.resilience.recordSuccess()
        return result
      } catch (error: any) {
        lastError = error

        if (error.headers) {
          this.api.resilience.updateRateLimit(new Headers(error.headers))
        }

        if (!this.api.resilience.shouldRetry(retryCount, error)) {
          this.api.resilience.recordFailure()
          throw error
        }

        const delay = this.api.resilience.getRetryDelay(retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        retryCount++
      }
    }

    this.api.resilience.recordFailure()
    throw lastError
  }

  // Collection operations
  async createCollection(schema: TypesenseCollection): Promise<TypesenseCollectionOutput> {
    return this.wrapCall(
      () => this.api.collections.create(schema),
      'createCollection'
    )
  }

  async getCollection(name?: string): Promise<TypesenseCollectionOutput> {
    return this.wrapCall(
      () => this.api.collections.get(name),
      'getCollection'
    )
  }

  async updateCollection(schema: Partial<TypesenseCollection>, name?: string): Promise<TypesenseCollectionOutput> {
    return this.wrapCall(
      () => this.api.collections.update(schema, { collection: name }),
      'updateCollection'
    )
  }

  async deleteCollection(name?: string): Promise<TypesenseCollectionOutput> {
    return this.wrapCall(
      () => this.api.collections.delete(name),
      'deleteCollection'
    )
  }

  async listCollections(): Promise<TypesenseCollectionOutput[]> {
    return this.wrapCall(
      () => this.api.collections.list(),
      'listCollections'
    )
  }

  async getOrCreateCollection(schema: TypesenseCollection): Promise<TypesenseCollectionOutput> {
    return this.wrapCall(
      () => this.api.collections.getOrCreate(schema),
      'getOrCreateCollection'
    )
  }

  // Document operations
  async insertDocument(document: WithRequiredId<T>, collection?: string): Promise<T> {
    return this.wrapCall(
      () => this.api.documents.insert(document, { collection }),
      'insertDocument'
    )
  }

  async upsertDocument(document: WithRequiredId<T>, collection?: string): Promise<T> {
    return this.wrapCall(
      () => this.api.documents.upsert(document, { collection }),
      'upsertDocument'
    )
  }

  async updateDocument(id: string, update: Partial<T>, collection?: string): Promise<T> {
    return this.wrapCall(
      () => this.api.documents.update({ ...update, id }, { collection }),
      'updateDocument'
    )
  }

  async deleteDocument(id: string, collection?: string): Promise<T> {
    return this.wrapCall(
      () => this.api.documents.delete(id, { collection }),
      'deleteDocument'
    )
  }

  async getDocumentById(id: string, collection?: string): Promise<T> {
    return this.wrapCall(
      () => this.api.documents.getById(id, { collection }),
      'getDocumentById'
    )
  }

  async deleteByFilter(filter: string, options?: TypesenseDeleteByFilterOptions & { collection?: string }): Promise<{ num_deleted: number }> {
    return this.wrapCall(
      () => this.api.documents.deleteByFilter(filter, options),
      'deleteByFilter'
    )
  }

  async clearCollectionDocuments(collection?: string): Promise<{ num_deleted: number }> {
    return this.wrapCall(
      () => this.api.documents.clear({ collection }),
      'clearCollectionDocuments'
    )
  }

  // Import/Export operations
  async importDocuments(
    documents: string | T[] | Readable,
    formatOrOptions?: TypesenseImportFormat | (TypesenseImportOptions & { collection?: string }),
    options?: TypesenseImportOptions & { collection?: string }
  ): Promise<TypesenseImportResult[]> {
    // Handle overloaded parameters
    let format: TypesenseImportFormat = 'jsonl'
    let finalOptions: TypesenseImportOptions & { collection?: string }
    
    if (typeof formatOrOptions === 'string') {
      format = formatOrOptions
      finalOptions = options || {}
    } else {
      finalOptions = formatOrOptions || {}
      format = finalOptions.format || 'jsonl'
    }

    const { collection, format: _, ...importOptions } = finalOptions
    return this.wrapCall(
      () => this.api.documents.import(
        documents as any,
        format,
        importOptions,
        { collection }
      ),
      'importDocuments'
    )
  }

  async exportDocuments(
    format: TypesenseExportFormat = 'jsonl',
    options?: TypesenseExportOptions & { collection?: string }
  ): Promise<T[] | string> {
    const { collection, ...exportOptions } = options || {}
    return this.wrapCall(
      () => this.api.documents.export(
        format,
        { ...exportOptions, collection }
      ),
      'exportDocuments'
    )
  }

  async exportDocumentsStream(
    format: TypesenseExportFormat = 'jsonl',
    options?: TypesenseExportOptions & { collection?: string }
  ): Promise<Readable> {
    const { collection, ...exportOptions } = options || {}
    return this.wrapCall(
      () => this.api.documents.exportStream(
        { ...exportOptions, collection }
      ),
      'exportDocumentsStream'
    )
  }

  // Search operations
  async search(query: TypesenseQuery, collection?: string): Promise<TypesenseQueryResults<T>> {
    return this.wrapCall(
      () => this.api.search.query(query, { collection }),
      'search'
    )
  }

  async searchText(query: TypesenseTextQuery, collection?: string): Promise<TypesenseQueryResults<T>> {
    return this.wrapCall(
      () => this.api.search.text(query, { collection }),
      'searchText'
    )
  }

  async searchVector(query: TypesenseVectorQuery, collection?: string): Promise<TypesenseQueryResults<T>> {
    return this.wrapCall(
      () => this.api.search.vector(query, { collection }),
      'searchVector'
    )
  }

  async multiSearch(request: TypesenseMultiSearchRequest): Promise<TypesenseMultiSearchResult<T>> {
    return this.wrapCall(
      () => this.api.search.multi(request),
      'multiSearch'
    )
  }

  // Admin operations
  async health(): Promise<TypesenseHealth> {
    return this.wrapCall(
      () => this.api.admin.health(),
      'health'
    )
  }

  async waitForHealth(options?: { timeout?: number; interval?: number }): Promise<void> {
    return this.wrapCall(
      () => this.api.admin.waitForHealth(
        options?.timeout ? Math.floor(options.timeout / 1000) : 15,
        options?.interval || 1000
      ),
      'waitForHealth'
    )
  }

  async getMetrics(): Promise<TypesenseMetrics> {
    return this.wrapCall(
      () => this.api.admin.getMetrics(),
      'getMetrics'
    )
  }

  async getStats(): Promise<TypesenseClusterStatus> {
    return this.wrapCall(
      () => this.api.admin.getStats(),
      'getStats'
    )
  }

  async getCollectionStats(collection?: string): Promise<TypesenseCollectionStats> {
    return this.wrapCall(
      () => this.api.admin.getCollectionStats(collection),
      'getCollectionStats'
    )
  }

  // Alias operations
  async createOrUpdateAlias(name: string, targetCollection: string): Promise<TypesenseAliasResponse> {
    return this.wrapCall(
      () => this.api.aliases.createOrUpdate(name, targetCollection),
      'createOrUpdateAlias'
    )
  }

  async getAlias(name: string): Promise<TypesenseAliasResponse> {
    return this.wrapCall(
      () => this.api.aliases.get(name),
      'getAlias'
    )
  }

  async listAliases(): Promise<TypesenseAliasListResponse> {
    return this.wrapCall(
      () => this.api.aliases.list(),
      'listAliases'
    )
  }

  async deleteAlias(name: string): Promise<TypesenseAliasResponse> {
    return this.wrapCall(
      () => this.api.aliases.delete(name),
      'deleteAlias'
    )
  }

  // Synonym operations
  async upsertSynonym(synonym: TypesenseSynonym, collection?: string): Promise<TypesenseSynonymResponse> {
    return this.wrapCall(
      () => this.api.synonyms.upsert(synonym, { collection }),
      'upsertSynonym'
    )
  }

  async getSynonym(id: string, collection?: string): Promise<TypesenseSynonymResponse> {
    return this.wrapCall(
      () => this.api.synonyms.get(id, { collection }),
      'getSynonym'
    )
  }

  async listSynonyms(collection?: string): Promise<{ synonyms: TypesenseSynonymResponse[] }> {
    return this.wrapCall(
      () => this.api.synonyms.list({ collection }),
      'listSynonyms'
    )
  }

  async deleteSynonym(id: string, collection?: string): Promise<TypesenseSynonymResponse> {
    return this.wrapCall(
      () => this.api.synonyms.delete(id, { collection }),
      'deleteSynonym'
    )
  }

  // Override operations
  async upsertOverride(override: TypesenseOverride, collection?: string): Promise<TypesenseOverrideResponse> {
    return this.wrapCall(
      () => this.api.overrides.upsert(override, { collection }),
      'upsertOverride'
    )
  }

  async getOverride(id: string, collection?: string): Promise<TypesenseOverrideResponse> {
    return this.wrapCall(
      () => this.api.overrides.get(id, { collection }),
      'getOverride'
    )
  }

  async listOverrides(collection?: string): Promise<{ overrides: TypesenseOverrideResponse[] }> {
    return this.wrapCall(
      () => this.api.overrides.list({ collection }),
      'listOverrides'
    )
  }

  async deleteOverride(id: string, collection?: string): Promise<TypesenseOverrideResponse> {
    return this.wrapCall(
      () => this.api.overrides.delete(id, { collection }),
      'deleteOverride'
    )
  }

  // Preset operations
  async upsertPreset(preset: TypesensePreset): Promise<TypesensePresetResponse> {
    return this.wrapCall(
      () => this.api.presets.upsert(preset),
      'upsertPreset'
    )
  }

  async getPreset(name: string): Promise<TypesensePresetResponse> {
    return this.wrapCall(
      () => this.api.presets.get(name),
      'getPreset'
    )
  }

  async listPresets(): Promise<{ presets: TypesensePresetResponse[] }> {
    return this.wrapCall(
      () => this.api.presets.list(),
      'listPresets'
    )
  }

  async deletePreset(name: string): Promise<TypesensePresetResponse> {
    return this.wrapCall(
      () => this.api.presets.delete(name),
      'deletePreset'
    )
  }

  // Client management
  getResilienceStatus(): any {
    return this.api.getResilienceStatus()
  }

  getRateLimit(): TypesenseRateLimitInfo | null {
    return this.api.getRateLimit()
  }

  getCacheStats(): any {
    return this.api.getCacheStats()
  }

  getVersion(): string {
    return this.api.getVersion()
  }

  getTypesenseVersion(): string {
    return this.api.getTypesenseVersion()
  }

  // Backward compatibility
  get metrics() {
    return () => this.getMetrics()
  }

  destroy(): void {
    if (!this.destroyed) {
      this.api.destroy()
      this.destroyed = true
    }
  }
}
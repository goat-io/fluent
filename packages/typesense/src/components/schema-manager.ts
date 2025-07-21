// CollectionSchemaManager - Handles schema inference and caching
import { TypesenseCollection, TypesenseSchemaCacheEntry } from '../typesense.model'

interface SchemaManagerOptions {
  cacheSize?: number
  cacheTtl?: number
  enableNestedFields?: boolean
  typesenseVersion?: string
  suppressLogs?: boolean
}

class LRUCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

export class CollectionSchemaManager {
  private schemaCache: LRUCache<string, TypesenseSchemaCacheEntry>
  private options: Required<SchemaManagerOptions>

  constructor(options: SchemaManagerOptions = {}) {
    this.options = {
      cacheSize: options.cacheSize || 100,
      cacheTtl: options.cacheTtl || 300000, // 5 minutes
      enableNestedFields: options.enableNestedFields ?? false,
      typesenseVersion: options.typesenseVersion || '0.24.0',
      suppressLogs: options.suppressLogs ?? false
    }

    this.schemaCache = new LRUCache(this.options.cacheSize)
  }

  private isVersionSupported(feature: string, minVersion: string): boolean {
    const currentVersion = this.options.typesenseVersion
    return this.compareVersions(currentVersion, minVersion) >= 0
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }
    
    return 0
  }

  getCachedSchema(collectionName: string): TypesenseCollection | null {
    const cacheKey = `schema:${collectionName}`
    const cached = this.schemaCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.options.cacheTtl) {
      return cached.schema
    }
    
    if (cached) {
      this.schemaCache.delete(cacheKey)
    }
    
    return null
  }

  setCachedSchema(collectionName: string, schema: TypesenseCollection): void {
    const cacheKey = `schema:${collectionName}`
    this.schemaCache.set(cacheKey, {
      schema,
      timestamp: Date.now()
    })
  }

  deleteCachedSchema(collectionName: string): void {
    const cacheKey = `schema:${collectionName}`
    this.schemaCache.delete(cacheKey)
  }

  inferSchemaFromDocument(document: any, collectionName: string): TypesenseCollection {
    const fields: any[] = []
    const processedFields = new Set<string>()

    const inferFieldType = (key: string, value: any, path: string[] = []): void => {
      if (processedFields.has(key)) return
      
      const field: any = { name: key }

      if (value === null || value === undefined) {
        field.type = 'string'
        field.optional = true
      } else if (typeof value === 'string') {
        field.type = 'string'
      } else if (typeof value === 'number') {
        field.type = Number.isInteger(value) ? 'int64' : 'float'
      } else if (typeof value === 'boolean') {
        field.type = 'bool'
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          field.type = 'string[]'
        } else {
          // Check if array is homogeneous by sampling elements
          const sampleSize = Math.min(value.length, 10)
          const types = new Set()
          
          for (let i = 0; i < sampleSize; i++) {
            const item = value[i]
            if (typeof item === 'string') types.add('string')
            else if (typeof item === 'number') {
              types.add(Number.isInteger(item) ? 'int64' : 'float')
            }
            else if (typeof item === 'boolean') types.add('bool')
            else types.add('object')
          }

          if (types.size === 1) {
            const type = Array.from(types)[0] as string
            field.type = `${type}[]`
          } else {
            // Heterogeneous array - fall back to auto
            field.type = 'auto'
          }
        }
      } else if (typeof value === 'object') {
        // Check if nested fields are supported
        if (this.isVersionSupported('nested_fields', '0.25.0') && this.options.enableNestedFields) {
          field.type = 'object'
          // Could recursively process nested fields here
        } else {
          field.type = 'string' // Store as JSON string
        }
      } else {
        field.type = 'auto'
      }

      processedFields.add(key)
      fields.push(field)
    }

    // Process document fields
    Object.entries(document).forEach(([key, value]) => {
      inferFieldType(key, value)
    })

    // Ensure id field exists
    if (!processedFields.has('id')) {
      fields.unshift({ name: 'id', type: 'string' })
    }

    const collection: TypesenseCollection = {
      name: collectionName,
      fields
    }

    // Add version-gated features
    if (this.isVersionSupported('nested_fields', '0.25.0') && this.options.enableNestedFields) {
      collection.enable_nested_fields = true
    }

    return collection
  }

  validateSchema(schema: TypesenseCollection): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!schema.name) {
      errors.push('Collection name is required')
    }

    if (!schema.fields || schema.fields.length === 0) {
      errors.push('At least one field is required')
    }

    const hasIdField = schema.fields?.some(field => field.name === 'id')
    if (!hasIdField) {
      errors.push('Collection must have an "id" field')
    }

    // Validate field types
    const validTypes = [
      'string', 'string[]', 'int32', 'int32[]', 'int64', 'int64[]',
      'float', 'float[]', 'bool', 'bool[]', 'geopoint', 'geopoint[]',
      'object', 'object[]', 'auto', 'image'
    ]

    schema.fields?.forEach(field => {
      if (!validTypes.includes(field.type)) {
        errors.push(`Invalid field type "${field.type}" for field "${field.name}"`)
      }
    })

    // Check version-specific features
    if (schema.enable_nested_fields && !this.isVersionSupported('nested_fields', '0.25.0')) {
      errors.push('enable_nested_fields requires Typesense v0.25.0 or higher')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  clearCache(): void {
    this.schemaCache.clear()
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.schemaCache.size(),
      maxSize: this.options.cacheSize
    }
  }

  setTypesenseVersion(version: string): void {
    this.options.typesenseVersion = version
    // Clear cache when version changes as feature availability may change
    this.clearCache()
  }
}
# PouchDB Performance Optimization

This guide covers strategies and techniques for optimizing PouchDB performance across different scenarios and environments.

## Understanding PouchDB Performance

### Performance Factors

1. **Storage Backend** - Different adapters have varying performance characteristics
2. **Document Size** - Larger documents require more processing time
3. **Index Strategy** - Proper indexing dramatically improves query performance
4. **Sync Patterns** - How you sync affects both local and network performance
5. **Memory Usage** - Large datasets can impact browser memory limits

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, number[]>()

  async measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await operation()
      const duration = performance.now() - start
      
      this.recordMetric(name, duration)
      console.log(`${name}: ${duration.toFixed(2)}ms`)
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.log(`${name} (failed): ${duration.toFixed(2)}ms`)
      throw error
    }
  }

  private recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const measurements = this.metrics.get(name)!
    measurements.push(duration)
    
    // Keep only last 100 measurements
    if (measurements.length > 100) {
      measurements.shift()
    }
  }

  getStats(name: string) {
    const measurements = this.metrics.get(name) || []
    if (measurements.length === 0) return null

    const sorted = [...measurements].sort((a, b) => a - b)
    return {
      count: measurements.length,
      avg: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    }
  }
}
```

## Storage Optimization

### Choosing the Right Adapter

```typescript
class AdapterBenchmark {
  async benchmarkAdapters() {
    const adapters = ['idb', 'websql', 'memory']
    const results = new Map<string, any>()

    for (const adapter of adapters) {
      try {
        const result = await this.benchmarkAdapter(adapter)
        results.set(adapter, result)
      } catch (error) {
        console.error(`Adapter ${adapter} not available:`, error)
      }
    }

    return results
  }

  private async benchmarkAdapter(adapter: string) {
    const db = new PouchDB(`benchmark-${adapter}`, { adapter })
    const docCount = 1000
    const docs = this.generateTestDocs(docCount)

    try {
      // Benchmark bulk insert
      const insertStart = performance.now()
      await db.bulkDocs(docs)
      const insertTime = performance.now() - insertStart

      // Benchmark query
      const queryStart = performance.now()
      await db.allDocs({ include_docs: true })
      const queryTime = performance.now() - queryStart

      // Benchmark single gets
      const getStart = performance.now()
      for (let i = 0; i < 100; i++) {
        await db.get(`doc-${i}`)
      }
      const getTime = performance.now() - getStart

      return {
        adapter,
        insertTime,
        queryTime,
        getTime,
        insertRate: docCount / (insertTime / 1000),
        queryRate: docCount / (queryTime / 1000),
        getRate: 100 / (getTime / 1000)
      }
    } finally {
      await db.destroy()
    }
  }

  private generateTestDocs(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      _id: `doc-${i}`,
      type: 'test',
      value: Math.random(),
      text: `Document ${i} with some text content`,
      timestamp: new Date().toISOString()
    }))
  }
}
```

### Storage Configuration

```typescript
class StorageOptimizer {
  createOptimizedDatabase(name: string, options: {
    adapter?: string
    autoCompaction?: boolean
    revsLimit?: number
    size?: number
  } = {}) {
    const config = {
      adapter: options.adapter || this.getBestAdapter(),
      auto_compaction: options.autoCompaction ?? true,
      revs_limit: options.revsLimit ?? 1, // Keep only current revision
      size: options.size ?? 50, // MB for mobile adapters
      ...this.getAdapterSpecificOptions(options.adapter)
    }

    return new PouchDB(name, config)
  }

  private getBestAdapter(): string {
    // Adapter priority based on performance
    if (typeof window !== 'undefined') {
      // Browser environment
      if ('indexedDB' in window) return 'idb'
      if ('webkitIndexedDB' in window) return 'idb'
      if ('mozIndexedDB' in window) return 'idb'
      if ('openDatabase' in window) return 'websql'
    } else {
      // Node.js environment
      return 'leveldb'
    }
    
    return 'memory'
  }

  private getAdapterSpecificOptions(adapter?: string) {
    switch (adapter) {
      case 'idb':
        return {
          // IndexedDB specific options
          storage: 'persistent'
        }
      case 'leveldb':
        return {
          // LevelDB specific options
          db: require('level')
        }
      default:
        return {}
    }
  }
}
```

## Query Optimization

### Index Management

```typescript
class IndexManager {
  constructor(private db: PouchDB.Database) {}

  async createOptimalIndexes(schema: any) {
    const indexes = this.analyzeSchema(schema)
    
    for (const index of indexes) {
      await this.createIndex(index)
    }
  }

  private analyzeSchema(schema: any): Array<{
    fields: string[]
    name: string
    type?: string
  }> {
    const indexes = []

    // Create single-field indexes for commonly queried fields
    const queryableFields = ['type', 'status', 'userId', 'createdAt', 'updatedAt']
    
    for (const field of queryableFields) {
      if (schema.properties[field]) {
        indexes.push({
          fields: [field],
          name: `idx_${field}`
        })
      }
    }

    // Create compound indexes for common query patterns
    if (schema.properties.type && schema.properties.createdAt) {
      indexes.push({
        fields: ['type', 'createdAt'],
        name: 'idx_type_created'
      })
    }

    if (schema.properties.userId && schema.properties.status) {
      indexes.push({
        fields: ['userId', 'status'],
        name: 'idx_user_status'
      })
    }

    return indexes
  }

  private async createIndex(index: {
    fields: string[]
    name: string
    type?: string
  }) {
    try {
      await this.db.createIndex({
        index: {
          fields: index.fields,
          name: index.name,
          ddoc: index.name
        }
      })
      console.log(`Created index: ${index.name}`)
    } catch (error) {
      console.error(`Failed to create index ${index.name}:`, error)
    }
  }

  async analyzeQueryPerformance(selector: any) {
    const explain = await this.db.explain({
      selector,
      limit: 1
    })

    return {
      index: explain.index,
      indexUsed: explain.index.type !== 'special',
      estimatedCost: explain.execution_stats?.total_docs_examined,
      warning: explain.warning
    }
  }

  async optimizeQuery(selector: any, sort?: any[]) {
    const analysis = await this.analyzeQueryPerformance(selector)
    
    if (!analysis.indexUsed) {
      // Suggest index creation
      const fields = this.extractFieldsFromSelector(selector)
      if (sort) {
        fields.push(...sort.map(s => Object.keys(s)[0]))
      }
      
      console.warn(`Query not using index. Consider creating index on: ${fields.join(', ')}`)
      
      // Auto-create index if beneficial
      if (fields.length <= 3) {
        await this.createIndex({
          fields,
          name: `auto_idx_${fields.join('_')}`
        })
      }
    }

    return analysis
  }

  private extractFieldsFromSelector(selector: any): string[] {
    const fields = new Set<string>()
    
    const traverse = (obj: any, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) continue
        
        const fullPath = path ? `${path}.${key}` : key
        fields.add(fullPath)
        
        if (typeof value === 'object' && value !== null) {
          traverse(value, fullPath)
        }
      }
    }
    
    traverse(selector)
    return Array.from(fields)
  }
}
```

### Query Optimization Strategies

```typescript
class QueryOptimizer {
  constructor(private db: PouchDB.Database) {}

  async optimizedFind(selector: any, options: any = {}) {
    // Use limit to prevent large result sets
    const limit = Math.min(options.limit || 100, 1000)
    
    // Optimize selector
    const optimizedSelector = this.optimizeSelector(selector)
    
    // Use skip wisely (avoid large skip values)
    if (options.skip && options.skip > 1000) {
      return this.paginateWithBookmark(optimizedSelector, options)
    }

    return this.db.find({
      selector: optimizedSelector,
      ...options,
      limit
    })
  }

  private optimizeSelector(selector: any): any {
    // Convert equality checks to use $eq explicitly
    const optimized = { ...selector }
    
    for (const [key, value] of Object.entries(optimized)) {
      if (key.startsWith('$')) continue
      
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        optimized[key] = { $eq: value }
      }
    }

    return optimized
  }

  private async paginateWithBookmark(selector: any, options: any) {
    // Use bookmark for efficient pagination instead of skip
    let bookmark = options.bookmark
    const results = []
    let remaining = options.limit || 100

    while (remaining > 0) {
      const batch = await this.db.find({
        selector,
        limit: Math.min(remaining, 100),
        bookmark,
        sort: options.sort
      })

      results.push(...batch.docs)
      remaining -= batch.docs.length

      if (batch.docs.length === 0 || !batch.bookmark) {
        break
      }

      bookmark = batch.bookmark
    }

    return { docs: results, bookmark }
  }

  async bulkOptimizedGet(ids: string[]): Promise<any[]> {
    // Use allDocs for bulk operations
    const result = await this.db.allDocs({
      keys: ids,
      include_docs: true
    })

    return result.rows
      .filter(row => !row.error)
      .map(row => row.doc)
  }
}
```

## Memory Management

### Memory-Efficient Operations

```typescript
class MemoryManager {
  constructor(private db: PouchDB.Database) {}

  async processLargeDataset(
    selector: any,
    processor: (doc: any) => Promise<void>,
    batchSize = 100
  ) {
    let bookmark: string | undefined
    let processed = 0

    while (true) {
      const batch = await this.db.find({
        selector,
        limit: batchSize,
        bookmark
      })

      if (batch.docs.length === 0) break

      // Process batch
      for (const doc of batch.docs) {
        await processor(doc)
        processed++
      }

      // Clear processed docs from memory
      batch.docs.length = 0

      bookmark = batch.bookmark
      
      // Log progress
      if (processed % 1000 === 0) {
        console.log(`Processed ${processed} documents`)
        
        // Optional: Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
    }

    console.log(`Total processed: ${processed} documents`)
  }

  async streamChanges(
    onDoc: (doc: any) => void,
    options: any = {}
  ) {
    const changes = this.db.changes({
      since: 'now',
      live: true,
      include_docs: true,
      ...options
    })

    changes.on('change', (change) => {
      try {
        onDoc(change.doc)
      } catch (error) {
        console.error('Error processing change:', error)
      }
      
      // Clear change from memory
      change.doc = null
    })

    return changes
  }

  async compactAndCleanup() {
    // Compact database to reclaim space
    await this.db.compact()
    
    // Clean up old revisions
    const result = await this.db.allDocs()
    
    for (const row of result.rows) {
      try {
        await this.db.compact(row.id)
      } catch (error) {
        // Document might not exist or be corrupted
        console.warn(`Failed to compact ${row.id}:`, error)
      }
    }
  }
}
```

### Caching Strategies

```typescript
class SmartCache {
  private cache = new Map<string, { data: any; timestamp: number; hits: number }>()
  private maxSize = 1000
  private ttl = 5 * 60 * 1000 // 5 minutes

  constructor(private db: PouchDB.Database) {}

  async get(id: string): Promise<any> {
    // Check cache first
    const cached = this.cache.get(id)
    if (cached && this.isValid(cached)) {
      cached.hits++
      return cached.data
    }

    // Fetch from database
    const doc = await this.db.get(id)
    
    // Cache the result
    this.set(id, doc)
    
    return doc
  }

  private set(id: string, data: any) {
    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed()
    }

    this.cache.set(id, {
      data,
      timestamp: Date.now(),
      hits: 1
    })
  }

  private isValid(cached: { timestamp: number }): boolean {
    return Date.now() - cached.timestamp < this.ttl
  }

  private evictLeastUsed() {
    let leastUsed = { key: '', hits: Infinity }
    
    for (const [key, value] of this.cache) {
      if (value.hits < leastUsed.hits) {
        leastUsed = { key, hits: value.hits }
      }
    }

    if (leastUsed.key) {
      this.cache.delete(leastUsed.key)
    }
  }

  invalidate(id: string) {
    this.cache.delete(id)
  }

  clear() {
    this.cache.clear()
  }

  getStats() {
    const now = Date.now()
    let totalHits = 0
    let validEntries = 0

    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      if (this.isValid(entry)) {
        validEntries++
      }
    }

    return {
      size: this.cache.size,
      validEntries,
      totalHits,
      avgHits: totalHits / this.cache.size || 0
    }
  }
}
```

## Sync Performance

### Efficient Sync Strategies

```typescript
class SyncOptimizer {
  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database
  ) {}

  async intelligentSync() {
    // Check network conditions
    const networkInfo = this.getNetworkInfo()
    const syncOptions = this.getSyncOptions(networkInfo)

    return this.localDb.sync(this.remoteDb, syncOptions)
  }

  private getNetworkInfo() {
    // Use Network Information API if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      }
    }

    // Fallback detection
    return {
      effectiveType: 'unknown',
      downlink: 1,
      rtt: 100
    }
  }

  private getSyncOptions(networkInfo: any) {
    const baseOptions = {
      live: true,
      retry: true
    }

    // Adjust based on network conditions
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.downlink < 0.5) {
      return {
        ...baseOptions,
        batch_size: 10,
        batches_limit: 1,
        timeout: 30000,
        heartbeat: 45000
      }
    }

    if (networkInfo.effectiveType === '4g' || networkInfo.downlink > 2) {
      return {
        ...baseOptions,
        batch_size: 500,
        batches_limit: 10,
        timeout: 10000,
        heartbeat: 15000
      }
    }

    // Default for 3g/unknown
    return {
      ...baseOptions,
      batch_size: 100,
      batches_limit: 5,
      timeout: 15000,
      heartbeat: 30000
    }
  }

  async deltaSync(since?: string) {
    // Only sync changes since last sync
    const checkpoint = since || await this.getLastCheckpoint()
    
    return this.localDb.sync(this.remoteDb, {
      since: checkpoint,
      batch_size: 200,
      retry: true
    })
  }

  private async getLastCheckpoint(): Promise<string> {
    try {
      const checkpoint = await this.localDb.get('_local/last_checkpoint')
      return checkpoint.value
    } catch (error) {
      return '0' // Start from beginning
    }
  }

  async saveCheckpoint(checkpoint: string) {
    try {
      const doc = await this.localDb.get('_local/last_checkpoint')
      await this.localDb.put({
        ...doc,
        value: checkpoint
      })
    } catch (error) {
      await this.localDb.put({
        _id: '_local/last_checkpoint',
        value: checkpoint
      })
    }
  }
}
```

### Background Sync Optimization

```typescript
class BackgroundSyncManager {
  private syncQueue: Array<() => Promise<void>> = []
  private isProcessing = false
  private lastSync = 0
  private syncInterval = 30000 // 30 seconds

  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database
  ) {
    this.startBackgroundSync()
  }

  private startBackgroundSync() {
    setInterval(() => {
      if (this.shouldSync()) {
        this.queueSync()
      }
    }, 5000) // Check every 5 seconds
  }

  private shouldSync(): boolean {
    return (
      navigator.onLine &&
      Date.now() - this.lastSync > this.syncInterval &&
      !this.isProcessing
    )
  }

  private queueSync() {
    this.syncQueue.push(async () => {
      try {
        await this.localDb.sync(this.remoteDb, {
          timeout: 10000,
          batch_size: 50
        })
        this.lastSync = Date.now()
      } catch (error) {
        console.warn('Background sync failed:', error)
      }
    })

    this.processQueue()
  }

  private async processQueue() {
    if (this.isProcessing) return

    this.isProcessing = true

    while (this.syncQueue.length > 0) {
      const syncFn = this.syncQueue.shift()!
      await syncFn()
    }

    this.isProcessing = false
  }

  forceDeltaSync() {
    this.queueSync()
  }

  pause() {
    this.syncInterval = Infinity
  }

  resume() {
    this.syncInterval = 30000
  }
}
```

## Bulk Operations

### Optimized Bulk Processing

```typescript
class BulkProcessor {
  constructor(private db: PouchDB.Database) {}

  async bulkInsert(docs: any[], batchSize = 1000) {
    const results = []
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize)
      
      try {
        const result = await this.db.bulkDocs(batch)
        results.push(...result)
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(docs.length / batchSize)}`)
      } catch (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error)
        
        // Try individual inserts for failed batch
        const individualResults = await this.fallbackIndividualInserts(batch)
        results.push(...individualResults)
      }
    }

    return results
  }

  private async fallbackIndividualInserts(docs: any[]) {
    const results = []
    
    for (const doc of docs) {
      try {
        const result = await this.db.put(doc)
        results.push(result)
      } catch (error) {
        results.push({ error: error.message, id: doc._id })
      }
    }

    return results
  }

  async bulkUpdate(updates: Array<{ id: string; changes: any }>, batchSize = 500) {
    // Fetch documents in batches
    const docs = await this.bulkGet(updates.map(u => u.id))
    
    // Apply updates
    const updatedDocs = docs.map(doc => {
      const update = updates.find(u => u.id === doc._id)
      return update ? { ...doc, ...update.changes } : doc
    })

    // Save in batches
    return this.bulkInsert(updatedDocs, batchSize)
  }

  private async bulkGet(ids: string[]): Promise<any[]> {
    const result = await this.db.allDocs({
      keys: ids,
      include_docs: true
    })

    return result.rows
      .filter(row => !row.error)
      .map(row => row.doc)
  }

  async bulkDelete(ids: string[], batchSize = 1000) {
    // Get documents with revisions
    const docs = await this.bulkGet(ids)
    
    // Mark for deletion
    const deleteDocs = docs.map(doc => ({
      ...doc,
      _deleted: true
    }))

    return this.bulkInsert(deleteDocs, batchSize)
  }
}
```

## Browser-Specific Optimizations

### Web Worker Integration

```typescript
// main.ts
class WebWorkerPouchDB {
  private worker: Worker
  private requestId = 0
  private pendingRequests = new Map<number, { resolve: any; reject: any }>()

  constructor() {
    this.worker = new Worker('/pouchdb-worker.js')
    this.worker.onmessage = this.handleMessage.bind(this)
  }

  private handleMessage(event: MessageEvent) {
    const { id, result, error } = event.data
    const pending = this.pendingRequests.get(id)
    
    if (pending) {
      this.pendingRequests.delete(id)
      
      if (error) {
        pending.reject(new Error(error))
      } else {
        pending.resolve(result)
      }
    }
  }

  async bulkInsert(docs: any[]): Promise<any> {
    return this.sendRequest('bulkInsert', { docs })
  }

  async find(selector: any): Promise<any> {
    return this.sendRequest('find', { selector })
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      
      this.pendingRequests.set(id, { resolve, reject })
      
      this.worker.postMessage({
        id,
        method,
        params
      })
    })
  }
}

// pouchdb-worker.js
importScripts('https://cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js')

let db = new PouchDB('worker-db')

self.onmessage = async function(event) {
  const { id, method, params } = event.data
  
  try {
    let result
    
    switch (method) {
      case 'bulkInsert':
        result = await db.bulkDocs(params.docs)
        break
      case 'find':
        result = await db.find({ selector: params.selector })
        break
      default:
        throw new Error(`Unknown method: ${method}`)
    }
    
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: error.message })
  }
}
```

### Service Worker Caching

```typescript
// sw.js - Service Worker
const CACHE_NAME = 'pouchdb-cache-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/pouchdb.min.js',
        '/app.js',
        '/offline.html'
      ])
    })
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Fallback to local PouchDB data
          return handleOfflineRequest(event.request)
        })
    )
  }
})

async function handleOfflineRequest(request) {
  // Use cached responses or PouchDB data
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  // Return offline page
  return cache.match('/offline.html')
}
```

## Performance Testing

### Benchmarking Suite

```typescript
class PouchDBBenchmark {
  async runFullBenchmark(dbName = 'benchmark-db') {
    const results = {
      setup: await this.benchmarkSetup(dbName),
      crud: await this.benchmarkCRUD(dbName),
      query: await this.benchmarkQueries(dbName),
      bulk: await this.benchmarkBulkOps(dbName),
      sync: await this.benchmarkSync(dbName)
    }

    this.generateReport(results)
    return results
  }

  private async benchmarkSetup(dbName: string) {
    const db = new PouchDB(dbName)
    
    const start = performance.now()
    // Database initialization time
    await db.info()
    const initTime = performance.now() - start

    await db.destroy()
    return { initTime }
  }

  private async benchmarkCRUD(dbName: string) {
    const db = new PouchDB(dbName)
    const docCount = 1000

    try {
      // Create
      const createStart = performance.now()
      const docs = Array.from({ length: docCount }, (_, i) => ({
        _id: `doc-${i}`,
        type: 'test',
        value: Math.random(),
        text: `Test document ${i}`
      }))
      await db.bulkDocs(docs)
      const createTime = performance.now() - createStart

      // Read
      const readStart = performance.now()
      for (let i = 0; i < 100; i++) {
        await db.get(`doc-${i}`)
      }
      const readTime = performance.now() - readStart

      // Update
      const updateStart = performance.now()
      for (let i = 0; i < 100; i++) {
        const doc = await db.get(`doc-${i}`)
        await db.put({ ...doc, updated: true })
      }
      const updateTime = performance.now() - updateStart

      // Delete
      const deleteStart = performance.now()
      for (let i = 0; i < 100; i++) {
        const doc = await db.get(`doc-${i}`)
        await db.remove(doc)
      }
      const deleteTime = performance.now() - deleteStart

      return {
        createTime,
        readTime,
        updateTime,
        deleteTime,
        createRate: docCount / (createTime / 1000),
        readRate: 100 / (readTime / 1000),
        updateRate: 100 / (updateTime / 1000),
        deleteRate: 100 / (deleteTime / 1000)
      }
    } finally {
      await db.destroy()
    }
  }

  private async benchmarkQueries(dbName: string) {
    const db = new PouchDB(dbName)
    
    try {
      // Setup test data
      const docs = Array.from({ length: 1000 }, (_, i) => ({
        _id: `doc-${i}`,
        type: i % 3 === 0 ? 'typeA' : 'typeB',
        value: Math.floor(Math.random() * 100),
        category: i % 5
      }))
      await db.bulkDocs(docs)

      // Create index
      await db.createIndex({
        index: { fields: ['type', 'value'] }
      })

      // Benchmark queries
      const queryStart = performance.now()
      await db.find({
        selector: {
          type: 'typeA',
          value: { $gte: 50 }
        }
      })
      const queryTime = performance.now() - queryStart

      const allDocsStart = performance.now()
      await db.allDocs({ include_docs: true })
      const allDocsTime = performance.now() - allDocsStart

      return {
        queryTime,
        allDocsTime
      }
    } finally {
      await db.destroy()
    }
  }

  private async benchmarkBulkOps(dbName: string) {
    const db = new PouchDB(dbName)
    
    try {
      const docCounts = [100, 1000, 5000]
      const results = {}

      for (const count of docCounts) {
        const docs = Array.from({ length: count }, (_, i) => ({
          _id: `bulk-${count}-${i}`,
          data: `Document ${i}`
        }))

        const start = performance.now()
        await db.bulkDocs(docs)
        const time = performance.now() - start

        results[`bulk_${count}`] = {
          time,
          rate: count / (time / 1000)
        }
      }

      return results
    } finally {
      await db.destroy()
    }
  }

  private async benchmarkSync(dbName: string) {
    // This would require a test server
    // Simplified version
    return {
      syncTime: 0,
      note: 'Sync benchmark requires remote server'
    }
  }

  private generateReport(results: any) {
    console.log('\n=== PouchDB Performance Report ===')
    console.log(`Setup time: ${results.setup.initTime.toFixed(2)}ms`)
    console.log(`\nCRUD Performance:`)
    console.log(`  Create rate: ${results.crud.createRate.toFixed(0)} docs/sec`)
    console.log(`  Read rate: ${results.crud.readRate.toFixed(0)} docs/sec`)
    console.log(`  Update rate: ${results.crud.updateRate.toFixed(0)} docs/sec`)
    console.log(`  Delete rate: ${results.crud.deleteRate.toFixed(0)} docs/sec`)
    
    console.log(`\nQuery Performance:`)
    console.log(`  Find query: ${results.query.queryTime.toFixed(2)}ms`)
    console.log(`  All docs: ${results.query.allDocsTime.toFixed(2)}ms`)
    
    console.log(`\nBulk Operations:`)
    Object.entries(results.bulk).forEach(([key, value]: [string, any]) => {
      console.log(`  ${key}: ${value.rate.toFixed(0)} docs/sec`)
    })
  }
}
```

## Best Practices Summary

1. **Choose the right adapter** for your environment and use case
2. **Create proper indexes** for your query patterns
3. **Use bulk operations** for large datasets
4. **Implement intelligent caching** to reduce database hits
5. **Optimize sync patterns** based on network conditions
6. **Monitor performance** and adjust strategies accordingly
7. **Use Web Workers** for heavy processing in browsers
8. **Implement proper pagination** to avoid large result sets
9. **Compact databases regularly** to reclaim space
10. **Profile and benchmark** your specific use cases

Performance optimization is an ongoing process. Measure first, optimize second, and always test your improvements with real-world data and usage patterns.
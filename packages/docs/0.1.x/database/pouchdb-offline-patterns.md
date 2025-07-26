# PouchDB Offline-First Patterns

Offline-first development ensures your application works regardless of network connectivity. This guide covers patterns and strategies for building robust offline-first applications with PouchDB.

## Core Offline-First Principles

### 1. Local-First Data Storage
Always store data locally first, then sync to remote:

```typescript
class OfflineFirstRepository {
  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database
  ) {}

  async create(data: any) {
    // Always save locally first
    const doc = await this.localDb.post({
      ...data,
      _id: this.generateId(),
      createdAt: new Date().toISOString(),
      syncStatus: 'pending'
    })

    // Queue for sync
    this.queueSync(doc.id)
    
    return doc
  }

  private generateId() {
    // Use UUID that works offline
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
```

### 2. Optimistic Updates
Assume operations will succeed and handle failures gracefully:

```typescript
class OptimisticUpdater {
  async updateDocument(id: string, changes: any) {
    try {
      // Apply changes immediately
      const doc = await this.localDb.get(id)
      const updated = { ...doc, ...changes, updatedAt: new Date().toISOString() }
      
      // Update local immediately
      await this.localDb.put(updated)
      
      // Update UI
      this.notifyUpdate(updated)
      
      // Sync in background
      this.backgroundSync()
      
    } catch (error) {
      // Rollback and notify user
      await this.rollbackUpdate(id)
      this.notifyError(error)
    }
  }

  private async rollbackUpdate(id: string) {
    // Restore from backup or fetch from remote
    const backup = await this.getBackup(id)
    if (backup) {
      await this.localDb.put(backup)
      this.notifyUpdate(backup)
    }
  }
}
```

## Sync Queue Management

### Basic Sync Queue

```typescript
interface SyncQueueItem {
  id: string
  operation: 'create' | 'update' | 'delete'
  data?: any
  timestamp: number
  retries: number
}

class SyncQueue {
  private queue: SyncQueueItem[] = []
  private processing = false

  async add(item: Omit<SyncQueueItem, 'timestamp' | 'retries'>) {
    this.queue.push({
      ...item,
      timestamp: Date.now(),
      retries: 0
    })

    // Process queue if not already processing
    if (!this.processing) {
      this.processQueue()
    }
  }

  private async processQueue() {
    this.processing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      
      try {
        await this.processItem(item)
      } catch (error) {
        // Retry logic
        if (item.retries < 3) {
          item.retries++
          this.queue.unshift(item) // Add back to front
          await this.delay(1000 * item.retries) // Exponential backoff
        } else {
          // Move to failed queue
          this.handleFailedItem(item, error)
        }
      }
    }

    this.processing = false
  }

  private async processItem(item: SyncQueueItem) {
    switch (item.operation) {
      case 'create':
        await this.remoteDb.post(item.data)
        break
      case 'update':
        await this.remoteDb.put(item.data)
        break
      case 'delete':
        await this.remoteDb.remove(item.id)
        break
    }
  }
}
```

### Advanced Sync Queue with Persistence

```typescript
class PersistentSyncQueue {
  private queueDb: PouchDB.Database

  constructor(private remoteDb: PouchDB.Database) {
    this.queueDb = new PouchDB('sync-queue')
  }

  async add(operation: string, docId: string, data?: any) {
    const queueItem = {
      _id: `queue-${Date.now()}-${Math.random()}`,
      operation,
      docId,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0
    }

    await this.queueDb.put(queueItem)
    this.processQueue()
  }

  async processQueue() {
    const pending = await this.queueDb.find({
      selector: { status: 'pending' },
      sort: [{ createdAt: 'asc' }]
    })

    for (const item of pending.docs) {
      try {
        await this.processQueueItem(item)
        
        // Mark as completed
        await this.queueDb.put({
          ...item,
          status: 'completed',
          completedAt: new Date().toISOString()
        })
        
      } catch (error) {
        // Update retry count
        const updatedItem = {
          ...item,
          attempts: item.attempts + 1,
          lastError: error.message,
          lastAttempt: new Date().toISOString()
        }

        if (updatedItem.attempts >= 5) {
          updatedItem.status = 'failed'
        }

        await this.queueDb.put(updatedItem)
      }
    }
  }

  async retryFailed() {
    const failed = await this.queueDb.find({
      selector: { status: 'failed' }
    })

    for (const item of failed.docs) {
      await this.queueDb.put({
        ...item,
        status: 'pending',
        attempts: 0
      })
    }

    this.processQueue()
  }
}
```

## Conflict-Free Data Structures

### CRDT-Inspired Patterns

```typescript
// Counter that works offline
class OfflineCounter {
  private deviceId = this.getDeviceId()

  async increment(docId: string, amount = 1) {
    const doc = await this.localDb.get(docId).catch(() => ({
      _id: docId,
      counters: {}
    }))

    // Each device maintains its own counter
    if (!doc.counters) doc.counters = {}
    if (!doc.counters[this.deviceId]) doc.counters[this.deviceId] = 0
    
    doc.counters[this.deviceId] += amount
    doc.total = Object.values(doc.counters).reduce((sum, val) => sum + val, 0)

    return this.localDb.put(doc)
  }

  private getDeviceId() {
    // Generate stable device ID
    return localStorage.getItem('deviceId') || this.generateDeviceId()
  }
}

// Set that allows offline additions
class OfflineSet {
  async add(docId: string, value: any) {
    const doc = await this.localDb.get(docId).catch(() => ({
      _id: docId,
      items: {},
      deviceSets: {}
    }))

    const deviceId = this.getDeviceId()
    const itemId = `${deviceId}-${Date.now()}-${Math.random()}`
    
    // Add to device-specific set
    if (!doc.deviceSets[deviceId]) doc.deviceSets[deviceId] = {}
    doc.deviceSets[deviceId][itemId] = value
    
    // Merge all device sets
    doc.items = {}
    for (const deviceSet of Object.values(doc.deviceSets)) {
      Object.assign(doc.items, deviceSet)
    }

    return this.localDb.put(doc)
  }
}
```

### Last-Writer-Wins with Timestamps

```typescript
class LWWDocument {
  async update(docId: string, field: string, value: any) {
    const doc = await this.localDb.get(docId).catch(() => ({
      _id: docId,
      data: {},
      timestamps: {}
    }))

    const now = Date.now()
    
    // Only update if this is newer
    if (!doc.timestamps[field] || now > doc.timestamps[field]) {
      doc.data[field] = value
      doc.timestamps[field] = now
    }

    return this.localDb.put(doc)
  }

  // Merge function for conflicts
  mergeDocuments(local: any, remote: any) {
    const merged = { ...local }

    for (const [field, remoteValue] of Object.entries(remote.data)) {
      const remoteTime = remote.timestamps[field]
      const localTime = local.timestamps[field] || 0

      if (remoteTime > localTime) {
        merged.data[field] = remoteValue
        merged.timestamps[field] = remoteTime
      }
    }

    return merged
  }
}
```

## Network State Management

### Connection Monitoring

```typescript
class NetworkMonitor {
  private isOnline = navigator.onLine
  private listeners: Array<(online: boolean) => void> = []

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyListeners(true)
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners(false)
    })

    // Periodic connectivity check
    setInterval(() => {
      this.checkConnectivity()
    }, 30000)
  }

  private async checkConnectivity() {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      
      const online = response.ok
      if (online !== this.isOnline) {
        this.isOnline = online
        this.notifyListeners(online)
      }
    } catch {
      if (this.isOnline) {
        this.isOnline = false
        this.notifyListeners(false)
      }
    }
  }

  onStateChange(listener: (online: boolean) => void) {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online))
  }
}
```

### Adaptive Sync Strategy

```typescript
class AdaptiveSyncManager {
  private syncStrategy: 'aggressive' | 'conservative' | 'offline' = 'conservative'
  
  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database,
    private networkMonitor: NetworkMonitor
  ) {
    this.networkMonitor.onStateChange((online) => {
      this.updateSyncStrategy(online)
    })
  }

  private updateSyncStrategy(online: boolean) {
    if (!online) {
      this.syncStrategy = 'offline'
      this.pauseSync()
    } else {
      // Detect connection quality
      this.detectConnectionQuality().then((quality) => {
        this.syncStrategy = quality === 'good' ? 'aggressive' : 'conservative'
        this.adjustSyncSettings()
      })
    }
  }

  private async detectConnectionQuality(): Promise<'good' | 'poor'> {
    const start = Date.now()
    try {
      await fetch('/api/ping', { cache: 'no-cache' })
      const duration = Date.now() - start
      return duration < 1000 ? 'good' : 'poor'
    } catch {
      return 'poor'
    }
  }

  private adjustSyncSettings() {
    if (this.sync) {
      this.sync.cancel()
    }

    const options = this.getSyncOptions()
    this.sync = this.localDb.sync(this.remoteDb, options)
  }

  private getSyncOptions() {
    switch (this.syncStrategy) {
      case 'aggressive':
        return {
          live: true,
          retry: true,
          batch_size: 500,
          batches_limit: 10,
          timeout: 30000
        }
      case 'conservative':
        return {
          live: true,
          retry: true,
          batch_size: 50,
          batches_limit: 2,
          timeout: 10000
        }
      default:
        return null
    }
  }
}
```

## Data Versioning & Rollback

### Document Versioning

```typescript
class VersionedDocument {
  async update(docId: string, changes: any) {
    const doc = await this.localDb.get(docId)
    
    // Create version entry
    const version = {
      _id: `${docId}-v${Date.now()}`,
      type: 'version',
      parentId: docId,
      data: { ...doc },
      timestamp: new Date().toISOString()
    }
    
    // Save version
    await this.localDb.put(version)
    
    // Update document
    const updated = {
      ...doc,
      ...changes,
      version: version._id,
      updatedAt: new Date().toISOString()
    }
    
    return this.localDb.put(updated)
  }

  async rollback(docId: string, versionId: string) {
    const version = await this.localDb.get(versionId)
    const current = await this.localDb.get(docId)
    
    const restored = {
      ...current,
      ...version.data,
      restoredFrom: versionId,
      restoredAt: new Date().toISOString()
    }
    
    return this.localDb.put(restored)
  }

  async getVersionHistory(docId: string) {
    const result = await this.localDb.find({
      selector: {
        type: 'version',
        parentId: docId
      },
      sort: [{ timestamp: 'desc' }]
    })
    
    return result.docs
  }
}
```

### Snapshot and Restore

```typescript
class SnapshotManager {
  async createSnapshot(name: string) {
    const allDocs = await this.localDb.allDocs({
      include_docs: true,
      exclude_end: true,
      endkey: '_design\ufff0'
    })

    const snapshot = {
      _id: `snapshot-${name}-${Date.now()}`,
      type: 'snapshot',
      name,
      docs: allDocs.rows.map(row => row.doc),
      createdAt: new Date().toISOString()
    }

    return this.localDb.put(snapshot)
  }

  async restoreSnapshot(snapshotId: string) {
    const snapshot = await this.localDb.get(snapshotId)
    
    // Clear current data
    await this.clearDatabase()
    
    // Restore from snapshot
    const docs = snapshot.docs.map(doc => ({
      ...doc,
      _rev: undefined // Remove revision info
    }))
    
    return this.localDb.bulkDocs(docs)
  }

  private async clearDatabase() {
    const allDocs = await this.localDb.allDocs()
    const docsToDelete = allDocs.rows.map(row => ({
      _id: row.id,
      _rev: row.value.rev,
      _deleted: true
    }))
    
    return this.localDb.bulkDocs(docsToDelete)
  }
}
```

## Caching Strategies

### Intelligent Caching

```typescript
class IntelligentCache {
  private accessPatterns = new Map<string, number>()
  private lastAccess = new Map<string, number>()

  async get(id: string) {
    // Track access
    this.recordAccess(id)
    
    try {
      return await this.localDb.get(id)
    } catch (error) {
      if (error.status === 404) {
        // Try to fetch from remote if online
        return this.fetchFromRemote(id)
      }
      throw error
    }
  }

  private recordAccess(id: string) {
    const now = Date.now()
    this.accessPatterns.set(id, (this.accessPatterns.get(id) || 0) + 1)
    this.lastAccess.set(id, now)
  }

  async evictStaleData() {
    const now = Date.now()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    
    const staleIds = Array.from(this.lastAccess.entries())
      .filter(([id, lastAccessed]) => now - lastAccessed > maxAge)
      .sort((a, b) => (this.accessPatterns.get(a[0]) || 0) - (this.accessPatterns.get(b[0]) || 0))
      .slice(0, 100) // Evict least accessed first
      .map(([id]) => id)

    for (const id of staleIds) {
      try {
        const doc = await this.localDb.get(id)
        await this.localDb.remove(doc)
        this.accessPatterns.delete(id)
        this.lastAccess.delete(id)
      } catch (error) {
        // Document already deleted
      }
    }
  }
}
```

### Tiered Storage

```typescript
class TieredStorage {
  private hotCache = new Map<string, any>() // In-memory
  private warmDb: PouchDB.Database // Local storage
  private coldDb: PouchDB.Database // Remote

  constructor() {
    this.warmDb = new PouchDB('warm-cache')
    this.coldDb = new PouchDB('http://localhost:5984/app')
  }

  async get(id: string): Promise<any> {
    // Try hot cache first
    if (this.hotCache.has(id)) {
      return this.hotCache.get(id)
    }

    // Try warm cache
    try {
      const doc = await this.warmDb.get(id)
      this.hotCache.set(id, doc) // Promote to hot
      return doc
    } catch (error) {
      if (error.status !== 404) throw error
    }

    // Try cold storage
    try {
      const doc = await this.coldDb.get(id)
      await this.warmDb.put(doc) // Store in warm
      this.hotCache.set(id, doc) // Store in hot
      return doc
    } catch (error) {
      if (error.status !== 404) throw error
    }

    throw new Error(`Document ${id} not found`)
  }

  async put(doc: any) {
    // Store in all tiers
    this.hotCache.set(doc._id, doc)
    await this.warmDb.put(doc)
    
    // Queue for cold storage
    this.queueColdStorage(doc)
  }

  private queueColdStorage(doc: any) {
    // Use background sync or queue
    setTimeout(async () => {
      try {
        await this.coldDb.put(doc)
      } catch (error) {
        console.warn('Cold storage failed:', error)
      }
    }, 0)
  }
}
```

## User Experience Patterns

### Offline Indicators

```typescript
class OfflineIndicator {
  private indicator: HTMLElement

  constructor() {
    this.createIndicator()
    this.setupNetworkListeners()
  }

  private createIndicator() {
    this.indicator = document.createElement('div')
    this.indicator.id = 'offline-indicator'
    this.indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f39c12;
      color: white;
      text-align: center;
      padding: 10px;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
      z-index: 9999;
    `
    this.indicator.textContent = 'You are offline. Changes will sync when connection is restored.'
    document.body.appendChild(this.indicator)
  }

  private setupNetworkListeners() {
    window.addEventListener('offline', () => {
      this.show()
    })

    window.addEventListener('online', () => {
      this.hide()
    })
  }

  show() {
    this.indicator.style.transform = 'translateY(0)'
  }

  hide() {
    this.indicator.style.transform = 'translateY(-100%)'
  }

  showSyncStatus(message: string) {
    this.indicator.textContent = message
    this.indicator.style.background = '#27ae60'
    this.show()
    
    setTimeout(() => {
      this.hide()
    }, 3000)
  }
}
```

### Optimistic UI Updates

```typescript
class OptimisticUI {
  private pendingOperations = new Map<string, any>()

  async createItem(data: any) {
    const tempId = `temp-${Date.now()}`
    const optimisticItem = {
      id: tempId,
      ...data,
      status: 'creating',
      createdAt: new Date().toISOString()
    }

    // Show in UI immediately
    this.addToUI(optimisticItem)
    this.pendingOperations.set(tempId, optimisticItem)

    try {
      // Save to local database
      const result = await this.localDb.post(data)
      
      // Update UI with real ID
      const realItem = { ...optimisticItem, id: result.id, status: 'created' }
      this.updateUI(tempId, realItem)
      this.pendingOperations.delete(tempId)
      
      return realItem
    } catch (error) {
      // Show error state
      this.updateUI(tempId, { ...optimisticItem, status: 'error', error: error.message })
      return optimisticItem
    }
  }

  async deleteItem(id: string) {
    const item = this.getFromUI(id)
    
    // Show deleting state
    this.updateUI(id, { ...item, status: 'deleting' })
    
    try {
      await this.localDb.remove(id)
      this.removeFromUI(id)
    } catch (error) {
      // Restore item
      this.updateUI(id, { ...item, status: 'error', error: error.message })
    }
  }

  retryFailedOperations() {
    for (const [id, operation] of this.pendingOperations) {
      if (operation.status === 'error') {
        this.retryOperation(id, operation)
      }
    }
  }
}
```

## Performance Optimization

### Lazy Loading

```typescript
class LazyLoader {
  private loadedDocs = new Set<string>()
  private loadingPromises = new Map<string, Promise<any>>()

  async loadDocument(id: string) {
    if (this.loadedDocs.has(id)) {
      return this.localDb.get(id)
    }

    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)
    }

    const promise = this.loadDocumentInternal(id)
    this.loadingPromises.set(id, promise)

    try {
      const doc = await promise
      this.loadedDocs.add(id)
      return doc
    } finally {
      this.loadingPromises.delete(id)
    }
  }

  private async loadDocumentInternal(id: string) {
    // Try local first
    try {
      return await this.localDb.get(id)
    } catch (error) {
      if (error.status === 404 && navigator.onLine) {
        // Fetch from remote
        const doc = await this.remoteDb.get(id)
        await this.localDb.put(doc)
        return doc
      }
      throw error
    }
  }
}
```

### Background Sync

```typescript
class BackgroundSync {
  private worker: ServiceWorker | null = null

  async initialize() {
    if ('serviceWorker' in navigator) {
      this.worker = await navigator.serviceWorker.register('/sw.js')
      
      // Listen for sync events
      this.worker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          this.handleSyncComplete(event.data)
        }
      })
    }
  }

  async scheduleSync(data: any) {
    if (this.worker) {
      this.worker.postMessage({
        type: 'SCHEDULE_SYNC',
        data
      })
    }
  }

  private handleSyncComplete(data: any) {
    // Update UI with sync results
    console.log('Background sync complete:', data)
  }
}

// Service Worker (sw.js)
/*
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  const db = new PouchDB('myapp')
  const remoteDb = new PouchDB('http://localhost:5984/myapp')
  
  try {
    await db.sync(remoteDb)
    self.registration.showNotification('Sync complete')
  } catch (error) {
    console.error('Sync failed:', error)
  }
}
*/
```

## Testing Offline Scenarios

### Network Simulation

```typescript
class NetworkSimulator {
  private originalFetch = window.fetch

  enableOfflineMode() {
    window.fetch = () => Promise.reject(new Error('Network offline'))
  }

  enableSlowNetwork(delay = 3000) {
    window.fetch = async (url, options) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return this.originalFetch(url, options)
    }
  }

  enableUnreliableNetwork(failureRate = 0.3) {
    window.fetch = (url, options) => {
      if (Math.random() < failureRate) {
        return Promise.reject(new Error('Network error'))
      }
      return this.originalFetch(url, options)
    }
  }

  restoreNetwork() {
    window.fetch = this.originalFetch
  }
}

// Usage in tests
describe('Offline functionality', () => {
  const simulator = new NetworkSimulator()

  beforeEach(() => {
    simulator.enableOfflineMode()
  })

  afterEach(() => {
    simulator.restoreNetwork()
  })

  test('should work offline', async () => {
    // Test offline functionality
  })
})
```

These patterns ensure your application provides a smooth user experience regardless of network conditions, with proper data synchronization and conflict handling when connectivity is restored.
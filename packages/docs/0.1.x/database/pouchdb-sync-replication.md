# PouchDB Sync & Replication

PouchDB's killer feature is its ability to sync data between local and remote databases. This guide covers all aspects of synchronization and replication.

## Understanding Sync vs Replication

### Replication
One-way data transfer from source to target:
- `replicate.to()` - Push local changes to remote
- `replicate.from()` - Pull remote changes to local

### Synchronization
Bidirectional data transfer (combination of push and pull):
- `sync()` - Two-way replication in a single command

## Basic Replication

### One-Time Replication

```typescript
import PouchDB from 'pouchdb'

const localDb = new PouchDB('myapp')
const remoteDb = new PouchDB('http://localhost:5984/myapp')

// Push to remote
await localDb.replicate.to(remoteDb)

// Pull from remote
await localDb.replicate.from(remoteDb)

// With options
const result = await localDb.replicate.to(remoteDb, {
  filter: 'app/by_user',
  query_params: { user_id: '123' }
})

console.log('Replicated', result.docs_written, 'documents')
```

### Live Replication

```typescript
// Continuous replication
const replication = localDb.replicate.to(remoteDb, {
  live: true,
  retry: true
})

// Handle replication events
replication.on('change', (info) => {
  console.log('Replication change:', info)
})

replication.on('paused', (err) => {
  console.log('Replication paused:', err)
})

replication.on('active', () => {
  console.log('Replication active')
})

replication.on('denied', (err) => {
  console.log('Document denied:', err)
})

replication.on('complete', (info) => {
  console.log('Replication complete:', info)
})

replication.on('error', (err) => {
  console.log('Replication error:', err)
})

// Cancel replication
replication.cancel()
```

## Bidirectional Sync

### Basic Sync

```typescript
// Simple sync
const sync = localDb.sync(remoteDb)

// Live sync with retry
const sync = localDb.sync(remoteDb, {
  live: true,
  retry: true
})

// Handle sync events
sync.on('change', (info) => {
  // Handle change
  console.log('Sync change:', {
    direction: info.direction, // 'push' or 'pull'
    change: info.change
  })
})

sync.on('error', (err) => {
  console.error('Sync error:', err)
})
```

### Advanced Sync Options

```typescript
const sync = localDb.sync(remoteDb, {
  // Continuous sync
  live: true,
  
  // Retry on failure
  retry: true,
  
  // Custom retry backoff
  back_off_function: (delay) => {
    if (delay === 0) {
      return 1000 // First retry after 1s
    }
    return delay * 2 // Double the delay
  },
  
  // Batch configuration
  batch_size: 100,
  batches_limit: 5,
  
  // Performance options
  checkpoint: 'source', // 'target' or false
  
  // Timeout configuration
  timeout: 30000,
  
  // Since specific sequence
  since: 'now', // or sequence number
  
  // Heartbeat to prevent timeout
  heartbeat: 10000
})
```

## Filtered Replication

### Client-Side Filtering

```typescript
// Filter function runs on client
const sync = localDb.sync(remoteDb, {
  live: true,
  filter: (doc) => {
    // Only sync active users
    return doc.type === 'user' && doc.active === true
  }
})

// With doc IDs
const sync = localDb.sync(remoteDb, {
  doc_ids: ['user1', 'user2', 'user3']
})
```

### Server-Side Filtering

```typescript
// Design document with filter function
const ddoc = {
  _id: '_design/app',
  filters: {
    by_user: function(doc, req) {
      return doc.userId === req.query.user_id
    }.toString(),
    by_type: function(doc, req) {
      return doc.type === req.query.type
    }.toString()
  }
}

await remoteDb.put(ddoc)

// Use server-side filter
const sync = localDb.sync(remoteDb, {
  live: true,
  filter: 'app/by_user',
  query_params: { user_id: 'user123' }
})
```

### Selector-Based Filtering

```typescript
// Using Mango selectors (requires CouchDB 2.0+)
const sync = localDb.sync(remoteDb, {
  live: true,
  selector: {
    type: 'task',
    status: { $in: ['pending', 'active'] },
    assignee: 'user123'
  }
})
```

## Authentication & Security

### Basic Authentication

```typescript
// URL-based auth
const remoteDb = new PouchDB('http://user:pass@localhost:5984/myapp')

// Options-based auth
const remoteDb = new PouchDB('http://localhost:5984/myapp', {
  auth: {
    username: 'user',
    password: 'pass'
  }
})
```

### Session Authentication

```typescript
// Login to establish session
const response = await fetch('http://localhost:5984/_session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'user',
    password: 'pass'
  }),
  credentials: 'include'
})

// Use session cookie
const remoteDb = new PouchDB('http://localhost:5984/myapp', {
  fetch: (url, opts) => {
    opts.credentials = 'include'
    return PouchDB.fetch(url, opts)
  }
})
```

### JWT Authentication

```typescript
// Custom fetch with JWT
const remoteDb = new PouchDB('http://localhost:5984/myapp', {
  fetch: (url, opts) => {
    opts.headers = {
      ...opts.headers,
      'Authorization': `Bearer ${getJwtToken()}`
    }
    return PouchDB.fetch(url, opts)
  }
})
```

## Sync State Management

### Tracking Sync Progress

```typescript
class SyncManager {
  private syncHandler: any
  private syncState = {
    push: { pending: 0, failed: 0, written: 0 },
    pull: { pending: 0, failed: 0, written: 0 }
  }

  startSync(localDb: PouchDB.Database, remoteDb: PouchDB.Database) {
    this.syncHandler = localDb.sync(remoteDb, {
      live: true,
      retry: true
    })

    this.syncHandler.on('change', (info) => {
      if (info.direction === 'push') {
        this.syncState.push.written += info.change.docs_written
        this.syncState.push.failed += info.change.docs_read - info.change.docs_written
      } else {
        this.syncState.pull.written += info.change.docs_written
        this.syncState.pull.failed += info.change.docs_read - info.change.docs_written
      }
      
      this.onStateChange(this.syncState)
    })

    this.syncHandler.on('paused', (err) => {
      if (!err) {
        this.onSyncComplete()
      }
    })

    return this.syncHandler
  }

  private onStateChange(state: typeof this.syncState) {
    // Update UI or notify listeners
    console.log('Sync state:', state)
  }

  private onSyncComplete() {
    console.log('Sync complete, all changes processed')
  }

  stopSync() {
    if (this.syncHandler) {
      this.syncHandler.cancel()
    }
  }
}
```

### Checkpoint Management

```typescript
// Get replication checkpoints
const checkpoints = await localDb.get('_local/checkpoint-id')

// Reset checkpoint to force full sync
try {
  const checkpoint = await localDb.get('_local/checkpoint-id')
  await localDb.remove(checkpoint)
} catch (err) {
  // Checkpoint doesn't exist
}

// Disable checkpoints (always full sync)
const sync = localDb.sync(remoteDb, {
  checkpoint: false
})
```

## Performance Optimization

### Batch Configuration

```typescript
// Optimize for large datasets
const sync = localDb.sync(remoteDb, {
  batch_size: 1000, // Larger batches
  batches_limit: 10, // More parallel batches
  timeout: 60000, // Longer timeout
  heartbeat: 30000 // Prevent timeout
})

// Optimize for small, frequent changes
const sync = localDb.sync(remoteDb, {
  batch_size: 10, // Smaller batches
  batches_limit: 1, // Sequential processing
  timeout: 5000 // Quick timeout
})
```

### Selective Sync

```typescript
// Sync only recent documents
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const sync = localDb.sync(remoteDb, {
  filter: (doc) => {
    return new Date(doc.updatedAt) > yesterday
  }
})

// Progressive sync
async function progressiveSync(localDb, remoteDb) {
  // First sync critical data
  await localDb.sync(remoteDb, {
    filter: (doc) => doc.priority === 'high'
  })
  
  // Then sync recent data
  await localDb.sync(remoteDb, {
    filter: (doc) => doc.type === 'recent'
  })
  
  // Finally sync everything
  await localDb.sync(remoteDb)
}
```

## Conflict Prevention

### Sync Strategies

```typescript
// Master-slave pattern
class MasterSlaveSync {
  constructor(
    private localDb: PouchDB.Database,
    private masterDb: PouchDB.Database
  ) {}

  async sync() {
    // Always pull from master first
    await this.localDb.replicate.from(this.masterDb)
    
    // Then push local changes
    await this.localDb.replicate.to(this.masterDb)
  }
}

// Timestamp-based conflict prevention
function createTimestampedDoc(data: any) {
  return {
    ...data,
    _id: `${data.type}_${Date.now()}_${Math.random()}`,
    createdAt: new Date().toISOString(),
    deviceId: getDeviceId()
  }
}
```

### Sync Coordination

```typescript
// Prevent simultaneous syncs
class SyncCoordinator {
  private isSyncing = false
  private syncQueue: Array<() => void> = []

  async sync(localDb: PouchDB.Database, remoteDb: PouchDB.Database) {
    if (this.isSyncing) {
      // Queue sync request
      return new Promise((resolve) => {
        this.syncQueue.push(resolve)
      })
    }

    this.isSyncing = true

    try {
      await localDb.sync(remoteDb)
    } finally {
      this.isSyncing = false
      
      // Process queued syncs
      const nextSync = this.syncQueue.shift()
      if (nextSync) {
        nextSync()
      }
    }
  }
}
```

## Multi-Database Sync

### Hub and Spoke Pattern

```typescript
// Central hub with multiple clients
class HubSync {
  private clients: Map<string, PouchDB.Database> = new Map()
  
  constructor(private hub: PouchDB.Database) {}

  addClient(id: string, client: PouchDB.Database) {
    this.clients.set(id, client)
    
    // Start bidirectional sync
    const sync = client.sync(this.hub, {
      live: true,
      retry: true,
      filter: 'app/by_client',
      query_params: { client_id: id }
    })
    
    return sync
  }

  broadcast(doc: any) {
    // Send to hub, which syncs to all clients
    return this.hub.put({
      ...doc,
      broadcast: true,
      timestamp: new Date().toISOString()
    })
  }
}
```

### Mesh Network Pattern

```typescript
// Peer-to-peer sync
class MeshSync {
  private peers: Map<string, PouchDB.Database> = new Map()
  private syncs: Map<string, any> = new Map()

  addPeer(id: string, peerDb: PouchDB.Database) {
    this.peers.set(id, peerDb)
  }

  startMeshSync(localDb: PouchDB.Database) {
    for (const [peerId, peerDb] of this.peers) {
      const sync = localDb.sync(peerDb, {
        live: true,
        retry: true
      })
      
      this.syncs.set(peerId, sync)
    }
  }

  stopMeshSync() {
    for (const sync of this.syncs.values()) {
      sync.cancel()
    }
    this.syncs.clear()
  }
}
```

## Error Handling & Recovery

### Retry Strategies

```typescript
// Custom retry with exponential backoff
const sync = localDb.sync(remoteDb, {
  retry: true,
  back_off_function: (delay) => {
    if (delay === 0) {
      return 1000 // Start with 1 second
    }
    // Cap at 5 minutes
    return Math.min(delay * 2, 300000)
  }
})

// Manual retry on specific errors
async function syncWithRetry(localDb, remoteDb, maxRetries = 3) {
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      await localDb.sync(remoteDb)
      return // Success
    } catch (err) {
      retries++
      
      if (err.status === 401) {
        // Re-authenticate
        await reauthenticate()
      } else if (err.status === 500) {
        // Server error, wait longer
        await new Promise(resolve => setTimeout(resolve, 5000 * retries))
      } else {
        throw err // Unrecoverable error
      }
    }
  }
  
  throw new Error(`Sync failed after ${maxRetries} retries`)
}
```

### Connection Management

```typescript
// Handle network changes
class NetworkAwareSync {
  private sync: any

  constructor(
    private localDb: PouchDB.Database,
    private remoteDb: PouchDB.Database
  ) {
    this.setupNetworkListeners()
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network available, starting sync')
      this.startSync()
    })

    window.addEventListener('offline', () => {
      console.log('Network lost, pausing sync')
      this.pauseSync()
    })
  }

  startSync() {
    if (!this.sync && navigator.onLine) {
      this.sync = this.localDb.sync(this.remoteDb, {
        live: true,
        retry: true
      })
    }
  }

  pauseSync() {
    if (this.sync) {
      this.sync.cancel()
      this.sync = null
    }
  }
}
```

## Monitoring & Debugging

### Sync Metrics

```typescript
class SyncMetrics {
  private metrics = {
    docsRead: 0,
    docsWritten: 0,
    docsFailed: 0,
    startTime: Date.now(),
    lastSync: Date.now()
  }

  trackSync(localDb: PouchDB.Database, remoteDb: PouchDB.Database) {
    const sync = localDb.sync(remoteDb, { live: true })

    sync.on('change', (info) => {
      this.metrics.docsRead += info.change.docs_read
      this.metrics.docsWritten += info.change.docs_written
      this.metrics.docsFailed += info.change.doc_write_failures
      this.metrics.lastSync = Date.now()
      
      this.logMetrics()
    })

    return sync
  }

  private logMetrics() {
    const uptime = Date.now() - this.metrics.startTime
    console.log('Sync metrics:', {
      ...this.metrics,
      uptime: `${Math.floor(uptime / 1000)}s`,
      successRate: `${((this.metrics.docsWritten / this.metrics.docsRead) * 100).toFixed(2)}%`
    })
  }
}
```

## Best Practices

1. **Always handle offline scenarios** - Use retry and monitor network status
2. **Filter aggressively** - Only sync what you need
3. **Monitor sync progress** - Keep users informed
4. **Handle conflicts gracefully** - Have a clear conflict resolution strategy
5. **Test with poor connectivity** - Use network throttling
6. **Implement sync queues** - Prevent simultaneous syncs
7. **Use checkpoints wisely** - Reset when needed
8. **Monitor performance** - Track sync metrics
9. **Secure your sync** - Always use HTTPS and authentication
10. **Plan for scale** - Consider sync patterns for multiple clients

## Next Steps

- Master [offline-first patterns](./pouchdb-offline-patterns.md)
- Learn [conflict resolution](./pouchdb-conflict-resolution.md)
- Optimize with [performance tuning](./pouchdb-performance.md)
# PouchDB Local Database Setup

PouchDB is a JavaScript database that runs in the browser and Node.js, designed to sync seamlessly with CouchDB and compatible servers. This guide covers setting up PouchDB for local development and production use.

## Prerequisites

Before starting, ensure you have:
- Node.js 14+ installed
- npm, yarn, or pnpm package manager
- (Optional) CouchDB server for remote sync

## Installation

### Basic Installation

```bash
npm install @goatlab/fluent-pouchdb pouchdb
```

### Additional Plugins

PouchDB has a modular architecture. Install additional plugins as needed:

```bash
# For advanced querying
npm install pouchdb-find

# For in-memory adapter (testing)
npm install pouchdb-adapter-memory

# For IndexedDB adapter (browser)
npm install pouchdb-adapter-idb

# For LevelDB adapter (Node.js)
npm install pouchdb-adapter-leveldb
```

## Database Adapters

PouchDB supports multiple storage backends through adapters:

### Browser Adapters

#### IndexedDB (Default)
```typescript
import PouchDB from 'pouchdb'

// Uses IndexedDB by default in browsers
const db = new PouchDB('myapp')
```

#### WebSQL (Deprecated)
```typescript
import PouchDB from 'pouchdb'
import websqlAdapter from 'pouchdb-adapter-websql'

PouchDB.plugin(websqlAdapter)

const db = new PouchDB('myapp', { adapter: 'websql' })
```

#### In-Memory
```typescript
import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'

PouchDB.plugin(memoryAdapter)

// Useful for testing - data is lost on refresh
const db = new PouchDB('myapp', { adapter: 'memory' })
```

### Node.js Adapters

#### LevelDB (Default)
```typescript
import PouchDB from 'pouchdb'

// Uses LevelDB by default in Node.js
const db = new PouchDB('./myapp-db')
```

#### SQLite
```typescript
import PouchDB from 'pouchdb'
import sqliteAdapter from 'pouchdb-adapter-node-websql'

PouchDB.plugin(sqliteAdapter)

const db = new PouchDB('myapp', { adapter: 'websql' })
```

## Configuration Options

### Database Options

```typescript
const db = new PouchDB('myapp', {
  // Adapter selection
  adapter: 'idb', // 'idb', 'websql', 'memory', 'leveldb'
  
  // Auto-compaction (removes old revisions)
  auto_compaction: true,
  
  // Revision limit (how many old revisions to keep)
  revs_limit: 10,
  
  // Size (for adapters that support it)
  size: 50, // MB
  
  // Location (for mobile adapters)
  location: 'default',
  
  // Skip database creation check
  skip_setup: false
})
```

### Plugin Configuration

```typescript
import PouchDB from 'pouchdb'
import pouchdbFind from 'pouchdb-find'
import pouchdbDebug from 'pouchdb-debug'

// Add plugins
PouchDB.plugin(pouchdbFind)
PouchDB.plugin(pouchdbDebug)

// Enable debug mode
PouchDB.debug.enable('*')
// or specific modules
PouchDB.debug.enable('pouchdb:api')
PouchDB.debug.enable('pouchdb:http')
```

## Database Management

### Creating Databases

```typescript
// Create or open a database
const db = new PouchDB('users')

// Create with custom path (Node.js)
const db = new PouchDB('./data/users')

// Create remote database reference
const remoteDb = new PouchDB('http://localhost:5984/users')
```

### Database Information

```typescript
// Get database info
const info = await db.info()
console.log(info)
// {
//   db_name: "users",
//   doc_count: 4,
//   update_seq: 5,
//   ...
// }

// Check if database exists
try {
  await db.info()
  console.log('Database exists')
} catch (error) {
  console.log('Database does not exist')
}
```

### Destroying Databases

```typescript
// Destroy local database
await db.destroy()

// Destroy remote database
const remoteDb = new PouchDB('http://localhost:5984/users')
await remoteDb.destroy()
```

## Storage Strategies

### Browser Storage Limits

Different browsers have different storage limits:

| Browser | Storage Type | Limit |
|---------|--------------|-------|
| Chrome | IndexedDB | 60% of disk space |
| Firefox | IndexedDB | 50% of disk space |
| Safari | IndexedDB | 1GB (can request more) |
| Edge | IndexedDB | 60% of disk space |

### Managing Storage

```typescript
// Check storage usage (browser only)
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate()
  console.log(`Using ${estimate.usage} out of ${estimate.quota} bytes`)
}

// Request persistent storage (browser only)
if ('storage' in navigator && 'persist' in navigator.storage) {
  const isPersisted = await navigator.storage.persist()
  console.log(`Persisted storage granted: ${isPersisted}`)
}
```

### Storage Optimization

```typescript
// Compact database to reclaim space
await db.compact()

// Set auto-compaction
const db = new PouchDB('myapp', {
  auto_compaction: true,
  revs_limit: 1 // Keep only current revision
})

// Manual compaction with options
await db.compact({
  interval: 1000 // Compact every second during replication
})
```

## Performance Configuration

### Indexing Strategy

```typescript
// Create indexes for better query performance
await db.createIndex({
  index: {
    fields: ['type', 'createdAt'],
    name: 'type-date-index',
    ddoc: 'type-date-index'
  }
})

// Create partial index
await db.createIndex({
  index: {
    fields: ['status'],
    partial_filter_selector: {
      type: 'user',
      active: true
    }
  }
})
```

### Batch Size Configuration

```typescript
// Configure replication batch size
const sync = db.sync(remoteDb, {
  batch_size: 100, // Documents per batch
  batches_limit: 5 // Maximum parallel batches
})

// Configure changes feed batch size
const changes = db.changes({
  batch_size: 50,
  style: 'all_docs'
})
```

## Environment-Specific Setup

### Development

```typescript
// development.ts
import PouchDB from 'pouchdb'
import debugPlugin from 'pouchdb-debug'

PouchDB.plugin(debugPlugin)
PouchDB.debug.enable('*')

export function createDb(name: string) {
  return new PouchDB(name, {
    adapter: 'memory', // Fast, no persistence
    auto_compaction: false // Keep all revisions for debugging
  })
}
```

### Testing

```typescript
// test-setup.ts
import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'

PouchDB.plugin(memoryAdapter)

export function createTestDb() {
  // Unique name prevents test interference
  const dbName = `test-${Date.now()}-${Math.random()}`
  return new PouchDB(dbName, { adapter: 'memory' })
}

// Clean up after tests
export async function cleanupDb(db: PouchDB.Database) {
  await db.destroy()
}
```

### Production

```typescript
// production.ts
import PouchDB from 'pouchdb'

export function createDb(name: string) {
  return new PouchDB(name, {
    auto_compaction: true,
    revs_limit: 10,
    adapter: 'idb' // or 'leveldb' for Node.js
  })
}

// Enable error tracking
PouchDB.on('error', (err) => {
  console.error('PouchDB error:', err)
  // Send to error tracking service
})
```

## Security Considerations

### Browser Security

```typescript
// Use HTTPS for remote databases
const remoteDb = new PouchDB('https://example.com/db')

// Add authentication
const authenticatedDb = new PouchDB('https://example.com/db', {
  auth: {
    username: 'user',
    password: 'pass'
  }
})

// Use session authentication
const sessionDb = new PouchDB('https://example.com/db', {
  fetch: (url, opts) => {
    opts.credentials = 'include'
    return PouchDB.fetch(url, opts)
  }
})
```

### Node.js Security

```typescript
// Restrict database access
import { chmod } from 'fs/promises'

const db = new PouchDB('./secure-db')

// Set restrictive permissions (Unix-like systems)
await chmod('./secure-db', 0o700)

// Use environment variables for sensitive data
const remoteDb = new PouchDB(process.env.COUCH_URL, {
  auth: {
    username: process.env.COUCH_USER,
    password: process.env.COUCH_PASS
  }
})
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
```typescript
// Configure CouchDB for CORS
// In CouchDB config:
// [cors]
// origins = *
// credentials = true
```

2. **Storage Quota Exceeded**
```typescript
try {
  await db.put(doc)
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    // Handle storage full
    await db.compact()
    // or prompt user to free space
  }
}
```

3. **Database Locked**
```typescript
// Ensure single database instance
const instances = new Map()

export function getDb(name: string) {
  if (!instances.has(name)) {
    instances.set(name, new PouchDB(name))
  }
  return instances.get(name)
}
```

## Next Steps

- Learn about [sync and replication](./pouchdb-sync-replication.md)
- Explore [offline-first patterns](./pouchdb-offline-patterns.md)
- Master [conflict resolution](./pouchdb-conflict-resolution.md)
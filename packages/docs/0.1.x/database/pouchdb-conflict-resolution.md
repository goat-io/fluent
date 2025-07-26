# PouchDB Conflict Resolution

When multiple clients modify the same document simultaneously, conflicts arise. This guide covers strategies for detecting, resolving, and preventing conflicts in PouchDB applications.

## Understanding Conflicts

### What Causes Conflicts

Conflicts occur when:
1. Two clients modify the same document offline
2. Changes are made to different revisions of a document
3. Network partitions cause divergent updates
4. Concurrent modifications happen faster than sync

### PouchDB's Conflict Model

PouchDB uses Multi-Version Concurrency Control (MVCC):
- Each document has a unique revision (`_rev`)
- Updates require the current revision
- Conflicting revisions are kept as branches
- One revision is marked as the "winning" revision

## Detecting Conflicts

### Basic Conflict Detection

```typescript
class ConflictDetector {
  async checkForConflicts(docId: string): Promise<boolean> {
    try {
      const doc = await this.db.get(docId, { conflicts: true })
      return !!(doc._conflicts && doc._conflicts.length > 0)
    } catch (error) {
      if (error.status === 404) return false
      throw error
    }
  }

  async getConflictingRevisions(docId: string) {
    const doc = await this.db.get(docId, { conflicts: true })
    
    if (!doc._conflicts) {
      return { winner: doc, conflicts: [] }
    }

    // Get all conflicting revisions
    const conflicts = await Promise.all(
      doc._conflicts.map(rev => this.db.get(docId, { rev }))
    )

    return {
      winner: doc,
      conflicts
    }
  }
}
```

### Monitoring for Conflicts

```typescript
class ConflictMonitor {
  private conflictCallbacks: Array<(conflict: any) => void> = []

  startMonitoring(db: PouchDB.Database) {
    // Watch for changes that indicate conflicts
    const changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true,
      conflicts: true
    })

    changes.on('change', (change) => {
      if (change.doc._conflicts) {
        this.handleConflict(change.doc)
      }
    })

    return changes
  }

  onConflict(callback: (conflict: any) => void) {
    this.conflictCallbacks.push(callback)
  }

  private handleConflict(doc: any) {
    this.conflictCallbacks.forEach(callback => {
      try {
        callback(doc)
      } catch (error) {
        console.error('Error in conflict callback:', error)
      }
    })
  }
}
```

## Automatic Conflict Resolution

### Last-Writer-Wins Strategy

```typescript
class LastWriterWinsResolver {
  async resolveConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    
    // Find the document with the latest timestamp
    let latest = winner
    let latestTime = new Date(winner.updatedAt || winner.createdAt || 0)

    for (const conflict of conflicts) {
      const conflictTime = new Date(conflict.updatedAt || conflict.createdAt || 0)
      if (conflictTime > latestTime) {
        latest = conflict
        latestTime = conflictTime
      }
    }

    // If the winner isn't the latest, update it
    if (latest._rev !== winner._rev) {
      const resolved = {
        ...latest,
        _rev: winner._rev,
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'last-writer-wins'
      }

      await this.db.put(resolved)
    }

    // Remove conflicting revisions
    await this.removeConflictingRevisions(docId, conflicts)
  }

  private async removeConflictingRevisions(docId: string, conflicts: any[]) {
    const deletePromises = conflicts.map(conflict =>
      this.db.remove(docId, conflict._rev)
    )
    
    await Promise.all(deletePromises)
  }
}
```

### Field-Level Merge Strategy

```typescript
interface MergeRule {
  field: string
  strategy: 'newest' | 'oldest' | 'max' | 'min' | 'sum' | 'concat' | 'custom'
  customResolver?: (values: any[]) => any
}

class FieldMergeResolver {
  constructor(private mergeRules: MergeRule[]) {}

  async resolveConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    const allVersions = [winner, ...conflicts]

    const merged = this.mergeFields(allVersions)
    
    // Update with merged data
    const resolved = {
      ...merged,
      _rev: winner._rev,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'field-merge',
      conflictVersions: allVersions.map(v => ({
        rev: v._rev,
        updatedAt: v.updatedAt
      }))
    }

    await this.db.put(resolved)
    await this.removeConflictingRevisions(docId, conflicts)
  }

  private mergeFields(versions: any[]) {
    const merged = { ...versions[0] }

    for (const rule of this.mergeRules) {
      const values = versions.map(v => v[rule.field]).filter(v => v !== undefined)
      
      if (values.length <= 1) continue

      switch (rule.strategy) {
        case 'newest':
          merged[rule.field] = this.getNewestValue(versions, rule.field)
          break
        case 'oldest':
          merged[rule.field] = this.getOldestValue(versions, rule.field)
          break
        case 'max':
          merged[rule.field] = Math.max(...values)
          break
        case 'min':
          merged[rule.field] = Math.min(...values)
          break
        case 'sum':
          merged[rule.field] = values.reduce((sum, val) => sum + val, 0)
          break
        case 'concat':
          merged[rule.field] = values.join(', ')
          break
        case 'custom':
          if (rule.customResolver) {
            merged[rule.field] = rule.customResolver(values)
          }
          break
      }
    }

    return merged
  }

  private getNewestValue(versions: any[], field: string) {
    return versions
      .filter(v => v[field] !== undefined)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0][field]
  }

  private getOldestValue(versions: any[], field: string) {
    return versions
      .filter(v => v[field] !== undefined)
      .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))[0][field]
  }
}

// Usage
const resolver = new FieldMergeResolver([
  { field: 'name', strategy: 'newest' },
  { field: 'score', strategy: 'max' },
  { field: 'tags', strategy: 'custom', customResolver: (values) => {
    // Merge arrays and remove duplicates
    return [...new Set(values.flat())]
  }}
])
```

### CRDT-Based Resolution

```typescript
// Conflict-free Replicated Data Type implementations
class CRDTResolver {
  async resolveCounterConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    const allVersions = [winner, ...conflicts]

    // G-Counter: merge by taking max for each actor
    const mergedCounters = {}
    for (const version of allVersions) {
      for (const [actor, count] of Object.entries(version.counters || {})) {
        mergedCounters[actor] = Math.max(mergedCounters[actor] || 0, count)
      }
    }

    const total = Object.values(mergedCounters).reduce((sum, val) => sum + val, 0)

    const resolved = {
      ...winner,
      counters: mergedCounters,
      total,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'crdt-counter'
    }

    await this.db.put(resolved)
    await this.removeConflictingRevisions(docId, conflicts)
  }

  async resolveSetConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    const allVersions = [winner, ...conflicts]

    // OR-Set: merge by union of all adds minus removes
    const added = new Set()
    const removed = new Set()

    for (const version of allVersions) {
      // Collect all added items
      for (const item of version.added || []) {
        added.add(item)
      }
      // Collect all removed items
      for (const item of version.removed || []) {
        removed.add(item)
      }
    }

    // Items are in set if added but not removed
    const items = Array.from(added).filter(item => !removed.has(item))

    const resolved = {
      ...winner,
      items,
      added: Array.from(added),
      removed: Array.from(removed),
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'crdt-set'
    }

    await this.db.put(resolved)
    await this.removeConflictingRevisions(docId, conflicts)
  }
}
```

## Manual Conflict Resolution

### User-Driven Resolution

```typescript
interface ConflictResolutionUI {
  showConflictResolution(docId: string, versions: any[]): Promise<any>
}

class ManualConflictResolver {
  constructor(private ui: ConflictResolutionUI) {}

  async resolveConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    const allVersions = [winner, ...conflicts]

    // Show conflict resolution UI
    const resolved = await this.ui.showConflictResolution(docId, allVersions)

    // Save resolved version
    const finalDoc = {
      ...resolved,
      _rev: winner._rev,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'manual',
      conflictVersions: allVersions.map(v => ({
        rev: v._rev,
        data: v
      }))
    }

    await this.db.put(finalDoc)
    await this.removeConflictingRevisions(docId, conflicts)

    return finalDoc
  }
}

// Example UI implementation
class ConflictResolutionModal implements ConflictResolutionUI {
  async showConflictResolution(docId: string, versions: any[]): Promise<any> {
    return new Promise((resolve) => {
      const modal = this.createModal(docId, versions, resolve)
      document.body.appendChild(modal)
    })
  }

  private createModal(docId: string, versions: any[], onResolve: (data: any) => void) {
    const modal = document.createElement('div')
    modal.className = 'conflict-modal'
    
    modal.innerHTML = `
      <div class="conflict-content">
        <h2>Conflict Resolution for ${docId}</h2>
        <div class="versions">
          ${versions.map((version, index) => `
            <div class="version" data-index="${index}">
              <h3>Version ${index + 1} (${version._rev})</h3>
              <pre>${JSON.stringify(version, null, 2)}</pre>
              <button onclick="selectVersion(${index})">Use This Version</button>
            </div>
          `).join('')}
        </div>
        <div class="merge-option">
          <h3>Create Custom Merge</h3>
          <textarea id="custom-merge" rows="10" cols="80">${JSON.stringify(versions[0], null, 2)}</textarea>
          <button onclick="useCustomMerge()">Use Custom Merge</button>
        </div>
      </div>
    `

    // Add event handlers
    ;(window as any).selectVersion = (index: number) => {
      onResolve(versions[index])
      document.body.removeChild(modal)
    }

    ;(window as any).useCustomMerge = () => {
      const textarea = modal.querySelector('#custom-merge') as HTMLTextAreaElement
      try {
        const customData = JSON.parse(textarea.value)
        onResolve(customData)
        document.body.removeChild(modal)
      } catch (error) {
        alert('Invalid JSON')
      }
    }

    return modal
  }
}
```

### Conflict Resolution Workflow

```typescript
class ConflictWorkflow {
  private resolvers = new Map<string, (docId: string) => Promise<void>>()
  
  constructor(private db: PouchDB.Database) {
    this.setupDefaultResolvers()
  }

  private setupDefaultResolvers() {
    // Register different resolvers for different document types
    this.registerResolver('user', this.resolveUserConflict.bind(this))
    this.registerResolver('document', this.resolveDocumentConflict.bind(this))
    this.registerResolver('counter', this.resolveCounterConflict.bind(this))
  }

  registerResolver(docType: string, resolver: (docId: string) => Promise<void>) {
    this.resolvers.set(docType, resolver)
  }

  async processConflicts() {
    // Find all documents with conflicts
    const result = await this.db.allDocs({
      include_docs: true,
      conflicts: true
    })

    const conflictedDocs = result.rows.filter(row => 
      row.doc._conflicts && row.doc._conflicts.length > 0
    )

    for (const row of conflictedDocs) {
      await this.resolveDocumentConflict(row.doc)
    }
  }

  private async resolveDocumentConflict(doc: any) {
    const docType = doc.type || 'default'
    const resolver = this.resolvers.get(docType) || this.defaultResolver

    try {
      await resolver(doc._id)
      console.log(`Resolved conflict for ${doc._id}`)
    } catch (error) {
      console.error(`Failed to resolve conflict for ${doc._id}:`, error)
      // Mark for manual resolution
      await this.markForManualResolution(doc._id, error)
    }
  }

  private async defaultResolver(docId: string) {
    // Default to last-writer-wins
    const lwwResolver = new LastWriterWinsResolver()
    await lwwResolver.resolveConflict(docId)
  }

  private async markForManualResolution(docId: string, error: any) {
    const doc = await this.db.get(docId)
    await this.db.put({
      ...doc,
      needsManualResolution: true,
      resolutionError: error.message,
      markedAt: new Date().toISOString()
    })
  }
}
```

## Preventing Conflicts

### Optimistic Locking

```typescript
class OptimisticLocking {
  async updateWithLock(docId: string, updateFn: (doc: any) => any, maxRetries = 3) {
    let retries = 0
    
    while (retries < maxRetries) {
      try {
        const doc = await this.db.get(docId)
        const updated = updateFn(doc)
        
        // Include original revision
        const result = await this.db.put({
          ...updated,
          _rev: doc._rev
        })
        
        return result
      } catch (error) {
        if (error.status === 409) { // Conflict
          retries++
          if (retries >= maxRetries) {
            throw new Error(`Update failed after ${maxRetries} retries`)
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100 * retries))
        } else {
          throw error
        }
      }
    }
  }
}
```

### Document Partitioning

```typescript
class DocumentPartitioner {
  // Separate documents by user to reduce conflicts
  createUserDocument(userId: string, data: any) {
    return {
      _id: `user_${userId}_${Date.now()}`,
      type: 'user_data',
      userId,
      ...data
    }
  }

  // Use time-based partitioning
  createTimePartitionedDocument(type: string, data: any) {
    const partition = Math.floor(Date.now() / (1000 * 60 * 60)) // Hourly partitions
    return {
      _id: `${type}_${partition}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      partition,
      ...data
    }
  }

  // Use device-specific documents
  createDeviceDocument(deviceId: string, data: any) {
    return {
      _id: `device_${deviceId}_${Date.now()}`,
      type: 'device_data',
      deviceId,
      ...data
    }
  }
}
```

### Operational Transforms

```typescript
class OperationalTransform {
  // Transform operations to handle concurrent edits
  transformTextOperation(op1: any, op2: any) {
    // Simple character-level operational transform
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return {
          ...op2,
          position: op2.position + op1.text.length
        }
      }
    }
    
    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return {
          ...op2,
          position: op2.position - op1.length
        }
      }
    }

    return op2
  }

  applyOperation(doc: any, operation: any) {
    const text = doc.content || ''
    
    switch (operation.type) {
      case 'insert':
        return {
          ...doc,
          content: text.slice(0, operation.position) + 
                  operation.text + 
                  text.slice(operation.position)
        }
      case 'delete':
        return {
          ...doc,
          content: text.slice(0, operation.position) + 
                  text.slice(operation.position + operation.length)
        }
      default:
        return doc
    }
  }
}
```

## Advanced Conflict Patterns

### Three-Way Merge

```typescript
class ThreeWayMerge {
  async resolveConflict(docId: string) {
    const { winner, conflicts } = await this.getConflictingRevisions(docId)
    
    if (conflicts.length !== 1) {
      throw new Error('Three-way merge requires exactly one conflict')
    }

    const current = winner
    const incoming = conflicts[0]
    
    // Find common ancestor
    const ancestor = await this.findCommonAncestor(current, incoming)
    
    if (!ancestor) {
      throw new Error('No common ancestor found')
    }

    // Perform three-way merge
    const merged = this.merge(ancestor, current, incoming)
    
    const resolved = {
      ...merged,
      _rev: current._rev,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'three-way-merge'
    }

    await this.db.put(resolved)
    await this.removeConflictingRevisions(docId, conflicts)
  }

  private async findCommonAncestor(doc1: any, doc2: any) {
    // Simplified - in practice, you'd track document lineage
    // or use timestamps to find likely common ancestor
    const history1 = await this.getDocumentHistory(doc1._id, doc1._rev)
    const history2 = await this.getDocumentHistory(doc2._id, doc2._rev)
    
    // Find most recent common revision
    for (const rev1 of history1) {
      if (history2.includes(rev1)) {
        return this.db.get(doc1._id, { rev: rev1 })
      }
    }
    
    return null
  }

  private merge(ancestor: any, current: any, incoming: any) {
    const merged = { ...ancestor }
    
    // Apply changes from both branches
    for (const key of Object.keys(current)) {
      if (current[key] !== ancestor[key]) {
        merged[key] = current[key] // Current wins
      }
    }
    
    for (const key of Object.keys(incoming)) {
      if (incoming[key] !== ancestor[key] && merged[key] === ancestor[key]) {
        merged[key] = incoming[key] // Incoming wins if current didn't change
      }
    }
    
    return merged
  }
}
```

### Collaborative Editing

```typescript
class CollaborativeEditor {
  private operations: any[] = []
  private state: any = {}

  async handleRemoteOperation(operation: any) {
    // Transform against local operations
    let transformedOp = operation
    
    for (const localOp of this.operations) {
      if (localOp.timestamp > operation.timestamp) {
        transformedOp = this.transform(transformedOp, localOp)
      }
    }

    // Apply transformed operation
    this.state = this.applyOperation(this.state, transformedOp)
    
    // Save state
    await this.saveState()
  }

  async handleLocalOperation(operation: any) {
    // Apply locally immediately
    this.state = this.applyOperation(this.state, operation)
    this.operations.push(operation)
    
    // Send to other clients
    await this.broadcastOperation(operation)
    
    // Save state
    await this.saveState()
  }

  private transform(op1: any, op2: any) {
    // Implement operational transform logic
    // This is simplified - real OT is more complex
    return op1
  }
}
```

## Testing Conflict Resolution

### Conflict Simulation

```typescript
class ConflictSimulator {
  async createConflict(docId: string) {
    const doc = await this.db.get(docId)
    
    // Create two conflicting versions
    const version1 = {
      ...doc,
      field1: 'value1',
      updatedAt: new Date().toISOString()
    }
    
    const version2 = {
      ...doc,
      field1: 'value2',
      updatedAt: new Date().toISOString()
    }

    // Force conflict by updating with same base revision
    await Promise.all([
      this.db.put(version1),
      this.db.put(version2).catch(() => {}) // Second will conflict
    ])
  }

  async testResolution(resolver: any, docId: string) {
    await this.createConflict(docId)
    
    const beforeConflict = await this.getConflictingRevisions(docId)
    expect(beforeConflict.conflicts.length).toBeGreaterThan(0)
    
    await resolver.resolveConflict(docId)
    
    const afterResolution = await this.getConflictingRevisions(docId)
    expect(afterResolution.conflicts.length).toBe(0)
  }
}
```

## Best Practices

1. **Choose the right strategy** - Different document types need different resolution strategies
2. **Prevent when possible** - Use partitioning and optimistic locking
3. **Resolve quickly** - Don't let conflicts accumulate
4. **Preserve data** - Keep conflict history for debugging
5. **Test thoroughly** - Simulate various conflict scenarios
6. **Monitor conflicts** - Track conflict frequency and resolution success
7. **User involvement** - Let users resolve important conflicts manually
8. **Document strategies** - Make conflict resolution rules clear to your team

Proper conflict resolution is crucial for maintaining data integrity in distributed applications. Choose strategies that match your application's requirements and user expectations.
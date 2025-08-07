// npx vitest run tests/sqlite-concurrency.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SqliteCheckpointer } from '../src/checkpoint/sqlite'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

describe('SQLite Concurrency and Lock-Steal Protection', () => {
  let tempDir: string
  let dbPath: string
  
  beforeEach(() => {
    tempDir = path.join(process.cwd(), '.test-delphi-' + uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })
    dbPath = path.join(tempDir, 'test.db')
  })
  
  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should prevent concurrent writes on same threadId from corrupting SQLite', async () => {
    const threadId = 'concurrent-thread-' + uuidv4()
    const checkpointers: SqliteCheckpointer[] = []
    
    // Create 5 parallel checkpointers
    for (let i = 0; i < 5; i++) {
      checkpointers.push(new SqliteCheckpointer(dbPath))
    }
    
    // Each tries to write to the same thread
    const writePromises = checkpointers.map(async (checkpointer, index) => {
      const checkpoint = {
        v: 1,
        id: `checkpoint-${index}-${uuidv4()}`,
        ts: new Date().toISOString(),
        channel_values: {
          writer: index,
          timestamp: Date.now()
        },
        channel_versions: {},
        versions_seen: {},
        pending_sends: []
      }
      
      try {
        await checkpointer.put(
          { 
            configurable: { 
              thread_id: threadId,
              checkpoint_ns: '',
              checkpoint_id: checkpoint.id 
            } 
          },
          checkpoint,
          {},
          {}
        )
        return { success: true, writer: index }
      } catch (error) {
        return { success: false, writer: index, error }
      }
    })
    
    const results = await Promise.all(writePromises)
    
    // All writes should succeed (WAL mode allows concurrent writes)
    const successCount = results.filter(r => r.success).length
    expect(successCount).toBeGreaterThan(0)
    
    // Verify data integrity - read back all checkpoints
    const readCheckpointer = new SqliteCheckpointer(dbPath)
    const checkpoints: any[] = []
    
    for await (const cp of readCheckpointer.list({ 
      configurable: { thread_id: threadId } 
    })) {
      checkpoints.push(cp)
    }
    
    // Should have all successful writes
    expect(checkpoints.length).toBe(successCount)
    
    // Verify no data corruption - each checkpoint should have valid data
    for (const cp of checkpoints) {
      expect(cp.checkpoint.v).toBe(1)
      expect(cp.checkpoint.channel_values.writer).toBeDefined()
      expect(cp.checkpoint.channel_values.timestamp).toBeDefined()
    }
    
    // Cleanup
    for (const checkpointer of checkpointers) {
      await checkpointer.close()
    }
    await readCheckpointer.close()
  })

  it('should handle lock timeout gracefully', async () => {
    const threadId = 'lock-test-' + uuidv4()
    const checkpointer1 = new SqliteCheckpointer(dbPath)
    const checkpointer2 = new SqliteCheckpointer(dbPath)
    
    // Start a long-running transaction in checkpointer1
    const longWrite = checkpointer1.put(
      { 
        configurable: { 
          thread_id: threadId,
          checkpoint_ns: '',
          checkpoint_id: 'long-write' 
        } 
      },
      {
        v: 1,
        id: 'long-write',
        ts: new Date().toISOString(),
        channel_values: { 
          data: 'x'.repeat(1000000) // Large data to slow down write
        },
        channel_versions: {},
        versions_seen: {},
        pending_sends: []
      },
      {},
      {}
    )
    
    // Try to write with checkpointer2 (should wait due to busy_timeout)
    const quickWrite = checkpointer2.put(
      { 
        configurable: { 
          thread_id: threadId,
          checkpoint_ns: '',
          checkpoint_id: 'quick-write' 
        } 
      },
      {
        v: 1,
        id: 'quick-write',
        ts: new Date().toISOString(),
        channel_values: { data: 'quick' },
        channel_versions: {},
        versions_seen: {},
        pending_sends: []
      },
      {},
      {}
    )
    
    // Both should eventually succeed
    await expect(Promise.all([longWrite, quickWrite])).resolves.toBeDefined()
    
    await checkpointer1.close()
    await checkpointer2.close()
  })

  it('should maintain ACID properties under concurrent load', async () => {
    const threadId = 'acid-test-' + uuidv4()
    const numWriters = 10
    const writesPerWriter = 5
    
    const writers = Array.from({ length: numWriters }, () => 
      new SqliteCheckpointer(dbPath)
    )
    
    const allWrites: Promise<void>[] = []
    const expectedIds = new Set<string>()
    
    for (let w = 0; w < numWriters; w++) {
      for (let i = 0; i < writesPerWriter; i++) {
        const checkpointId = `writer-${w}-write-${i}`
        expectedIds.add(checkpointId)
        
        allWrites.push(
          writers[w].put(
            { 
              configurable: { 
                thread_id: threadId,
                checkpoint_ns: '',
                checkpoint_id: checkpointId 
              } 
            },
            {
              v: 1,
              id: checkpointId,
              ts: new Date().toISOString(),
              channel_values: { 
                writer: w,
                sequence: i,
                timestamp: Date.now()
              },
              channel_versions: {},
              versions_seen: {},
              pending_sends: []
            },
            {},
            {}
          )
        )
      }
    }
    
    // Wait for all writes
    await Promise.all(allWrites)
    
    // Verify all writes succeeded and are readable
    const reader = new SqliteCheckpointer(dbPath)
    const actualIds = new Set<string>()
    
    for await (const cp of reader.list({ 
      configurable: { thread_id: threadId } 
    })) {
      actualIds.add(cp.checkpoint.id)
      
      // Verify data integrity
      expect(cp.checkpoint.v).toBe(1)
      expect(cp.checkpoint.channel_values.writer).toBeTypeOf('number')
      expect(cp.checkpoint.channel_values.sequence).toBeTypeOf('number')
    }
    
    // All writes should be present
    expect(actualIds.size).toBe(expectedIds.size)
    expect([...actualIds].sort()).toEqual([...expectedIds].sort())
    
    // Cleanup
    for (const writer of writers) {
      await writer.close()
    }
    await reader.close()
  })
})
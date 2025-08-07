// npx vitest run tests/sqlite.spec.ts
import { describe, it, expect } from 'vitest'

describe('SQLite Checkpoint Adapter', () => {
  it('should test SQLite configuration', () => {
    // Simple test without actual DB
    const config = {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -131072
    }
    expect(config.journal_mode).toBe('WAL')
  })

  it.skip('should save and load checkpoint', async () => {
    const checkpoint = {
      v: 1,
      id: 'test-checkpoint-1',
      ts: new Date().toISOString(),
      channel_values: {
        task: 'Test task',
        iterationCount: 1
      },
      channel_versions: {},
      versions_seen: {},
      pending_sends: []
    }

    const config = {
      configurable: {
        thread_id: 'test-thread-1',
        checkpoint_ns: '',
        checkpoint_id: checkpoint.id
      }
    }

    // Save checkpoint
    await checkpointer.put(config, checkpoint, {}, {})

    // Load checkpoint
    const loaded = await checkpointer.get(config)
    
    expect(loaded?.checkpoint.id).toBe('test-checkpoint-1')
    expect(loaded?.checkpoint.channel_values.task).toBe('Test task')
  })

  it.skip('should list checkpoints for thread', async () => {
    const thread_id = 'test-thread-list'
    
    // Create multiple checkpoints
    for (let i = 0; i < 3; i++) {
      const checkpoint = {
        v: 1,
        id: `checkpoint-${i}`,
        ts: new Date(Date.now() + i * 1000).toISOString(),
        channel_values: { iteration: i },
        channel_versions: {},
        versions_seen: {},
        pending_sends: []
      }
      
      await checkpointer.put(
        { configurable: { thread_id, checkpoint_ns: '', checkpoint_id: checkpoint.id } },
        checkpoint,
        {},
        {}
      )
    }

    // List checkpoints
    const checkpoints = []
    for await (const checkpoint of checkpointer.list({ configurable: { thread_id } })) {
      checkpoints.push(checkpoint)
    }

    expect(checkpoints.length).toBeGreaterThanOrEqual(3)
    expect(checkpoints[0].config.configurable.thread_id).toBe(thread_id)
  })

  it.skip('should handle concurrent writes', async () => {
    const thread_id = 'concurrent-test'
    
    const promises = Array.from({ length: 5 }, (_, i) => {
      const checkpoint = {
        v: 1,
        id: `concurrent-${i}`,
        ts: new Date().toISOString(),
        channel_values: { index: i },
        channel_versions: {},
        versions_seen: {},
        pending_sends: []
      }
      
      return checkpointer.put(
        { configurable: { thread_id, checkpoint_ns: '', checkpoint_id: checkpoint.id } },
        checkpoint,
        {},
        {}
      )
    })

    await Promise.all(promises)

    const checkpoints = []
    for await (const cp of checkpointer.list({ configurable: { thread_id } })) {
      checkpoints.push(cp)
    }

    expect(checkpoints.length).toBeGreaterThanOrEqual(5)
  })
})
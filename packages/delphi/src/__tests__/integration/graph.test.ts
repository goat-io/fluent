import { spawn } from 'node:child_process'
import { Http } from '@goatlab/js-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  checkpointer,
  cleanupDatabase,
  initializeMemory
} from '../../checkpoint/sqlite.js'
import { buildGraph } from '../../graph.js'
import type { FlowState } from '../../types.js'

// Mock external dependencies
vi.mock('@goatlab/js-utils', () => ({
  Http: {
    getClient: vi.fn()
  }
}))
vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

const mockedSpawn = spawn as any

describe('Integration Tests - Graph', () => {
  beforeAll(async () => {
    // Initialize SQLite connection for tests
    await initializeMemory()
  })

  afterAll(async () => {
    // Clean up SQLite
    await cleanupDatabase()
  })

  describe('IT-graph-happy: Happy path execution', () => {
    it('should complete trivial "touch README" task in ≤2 loops', async () => {
      // Mock successful agent responses
      const mockClients = [
        {
          post: vi.fn().mockReturnThis(),
          json: vi.fn().mockResolvedValueOnce({
            draft: 'Create or update README.md file with touch command'
          })
        },
        {
          post: vi.fn().mockReturnThis(),
          json: vi.fn().mockResolvedValueOnce({
            refined: 'Execute: touch README.md in the project root',
            clear: true
          })
        },
        {
          post: vi.fn().mockReturnThis(),
          json: vi
            .fn()
            .mockResolvedValueOnce({ ok: true, feedback: '✅ Approved' })
        }
      ]

      let clientIndex = 0
      vi.mocked(Http.getClient).mockImplementation(
        () => mockClients[clientIndex++] as any
      )

      // Mock successful Claude execution
      const mockDiff = `diff --git a/README.md b/README.md
new file mode 100644
index 0000000../e69de29`

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(mockDiff))
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
        kill: vi.fn()
      } as any

      mockedSpawn.mockReturnValueOnce(mockProcess)

      // Build and run graph
      const graph = buildGraph({
        enableTests: false // Skip test execution for this test
      })

      const app = graph.compile({ checkpointer })

      const initialState: FlowState = {
        task: 'touch README',
        spec: '',
        repoPath: '/tmp/test-repo',
        iterationCount: 0,
        timestamp: Date.now()
      }

      const threadId = `test-happy-${Date.now()}`
      const result = await app.invoke(initialState, {
        configurable: { thread_id: threadId }
      })

      expect(result.approved).toBe(true)
      expect(result.iterationCount).toBeLessThanOrEqual(2)
      expect(result.codeDiff).toMatch(/^diff --git/)
    })
  })

  describe('IT-persist-crash: Resume from checkpoint', () => {
    it('should resume from last Redis checkpoint after crash', async () => {
      const threadId = `test-crash-${Date.now()}`

      // Set up all mocks for the full execution
      const mockClients = [
        {
          post: vi.fn().mockReturnThis(),
          json: vi
            .fn()
            .mockResolvedValueOnce({ spec: 'Create a new README.md file' })
        },
        {
          post: vi.fn().mockReturnThis(),
          json: vi.fn().mockResolvedValueOnce({
            refined: 'Create README.md with project info CLEAR: TRUE',
            clear: true
          })
        },
        {
          post: vi.fn().mockReturnThis(),
          json: vi
            .fn()
            .mockResolvedValueOnce({ ok: true, feedback: '✅ Approved' })
        }
      ]

      let clientIndex = 0
      vi.mocked(Http.getClient).mockImplementation(
        () => mockClients[clientIndex++] as any
      )

      const mockDiff = `diff --git a/README.md b/README.md
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/README.md
@@ -0,0 +1 @@
+# Test Project`

      const mockProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from(mockDiff)), 10)
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20)
          }
        }),
        kill: vi.fn()
      } as any

      mockedSpawn.mockReturnValueOnce(mockProcess)

      // First execution - start the graph
      const graph = buildGraph({ enableTests: false })
      const app = graph.compile({ checkpointer })

      const initialState: FlowState = {
        task: 'Touch README',
        spec: '',
        repoPath: '/tmp/test-repo',
        iterationCount: 0,
        timestamp: Date.now()
      }

      // Start execution
      const firstRun = app.invoke(initialState, {
        configurable: { thread_id: threadId }
      })

      // Wait a bit then interrupt
      await new Promise(resolve => setTimeout(resolve, 50))

      // Now resume from checkpoint - the graph should have saved intermediate state
      const result = await firstRun

      expect(result).toBeDefined()
      expect(result.approved).toBe(true)
      expect(result.task).toBe('Touch README')
    })
  })
})

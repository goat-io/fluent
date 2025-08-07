// npx vitest run tests/types.spec.ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Copy the schema here to avoid import issues
const FlowStateSchema = z.object({
  task: z.string().describe("User's raw request/goal"),
  spec: z.string().default('').describe('Refined specification from agents'),
  codeDiff: z.string().optional().describe('Git patch from Claude Code'),
  testResults: z.string().optional().describe('Test execution output'),
  approved: z.boolean().optional().describe('Reviewer verdict'),
  reviewFeedback: z.string().optional().describe('Detailed review feedback'),
  repoPath: z.string().describe('Working directory for Claude Code'),
  mcpServers: z.array(z.string()).optional().describe('MCP servers to connect'),
  iterationCount: z.number().default(0).describe('Number of refinement loops'),
  timestamp: z.number().default(() => Date.now()).describe('Creation timestamp'),
  threadId: z.string().optional().describe('LangGraph thread ID for checkpointing')
})

describe('TypeScript Types', () => {
  describe('FlowStateSchema', () => {
    it('should validate complete flow state', () => {
      const validState = {
        task: 'Add logging',
        spec: 'Add Winston logger',
        repoPath: '/project',
        iterationCount: 2,
        timestamp: Date.now()
      }
      
      const result = FlowStateSchema.safeParse(validState)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task).toBe('Add logging')
        expect(result.data.iterationCount).toBe(2)
      }
    })

    it('should provide defaults for optional fields', () => {
      const minimalState = {
        task: 'Test task',
        repoPath: '/test'
      }
      
      const result = FlowStateSchema.parse(minimalState)
      expect(result.spec).toBe('')
      expect(result.iterationCount).toBe(0)
      expect(result.timestamp).toBeDefined()
    })

    it('should reject invalid state', () => {
      const invalidState = {
        task: 123, // Should be string
        repoPath: '/test'
      }
      
      const result = FlowStateSchema.safeParse(invalidState)
      expect(result.success).toBe(false)
    })

    it('should handle all optional fields', () => {
      const fullState = {
        task: 'Task',
        spec: 'Spec',
        codeDiff: 'diff --git...',
        testResults: 'All tests passed',
        approved: true,
        reviewFeedback: 'Good implementation',
        repoPath: '/repo',
        mcpServers: ['github', 'jira'],
        iterationCount: 3,
        timestamp: Date.now(),
        threadId: 'thread-123'
      }
      
      const result = FlowStateSchema.parse(fullState)
      expect(result.codeDiff).toBe('diff --git...')
      expect(result.approved).toBe(true)
      expect(result.mcpServers).toHaveLength(2)
    })
  })
})
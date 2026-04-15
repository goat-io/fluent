// npx vitest run src/__tests__/langgraph-executor.spec.ts

import type { StepPayload } from '@goatlab/delphi-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LangGraphStepExecutor } from '../LangGraphStepExecutor.js'

function createMockGraph(
  returnValue: any,
  options?: { pendingNodes?: boolean },
) {
  const compiled = {
    invoke: vi.fn().mockResolvedValue(returnValue),
    getState: vi.fn().mockResolvedValue({
      next: options?.pendingNodes ? ['human_review'] : [],
    }),
  }

  return {
    compile: vi.fn().mockReturnValue(compiled),
    _compiled: compiled,
  }
}

function makePayload(overrides: Partial<StepPayload> = {}): StepPayload {
  return {
    workflowRunId: 'run-1',
    stepName: 'test-step',
    tenantId: 'tenant-1',
    input: { task: 'do something' },
    attempt: 1,
    executorType: 'langgraph',
    executorConfig: { graphName: 'testGraph' },
    ...overrides,
  }
}

describe('LangGraphStepExecutor', () => {
  let executor: LangGraphStepExecutor
  let mockGraph: ReturnType<typeof createMockGraph>

  beforeEach(() => {
    mockGraph = createMockGraph({ result: 'success', data: [1, 2, 3] })
    executor = new LangGraphStepExecutor({
      graphs: new Map([['testGraph', () => mockGraph]]),
    })
  })

  describe('execute', () => {
    it('executes a registered graph', async () => {
      const result = await executor.execute(makePayload())

      expect(result.output).toEqual({ result: 'success', data: [1, 2, 3] })
      expect(mockGraph.compile).toHaveBeenCalled()
      expect(mockGraph._compiled.invoke).toHaveBeenCalledWith(
        { task: 'do something' },
        { configurable: { thread_id: 'run-1:test-step' } },
      )
    })

    it('passes executorConfig to graph factory', async () => {
      const factory = vi.fn().mockReturnValue(createMockGraph({ built: true }))
      executor.registerGraph('custom', factory)

      await executor.execute(
        makePayload({
          executorConfig: {
            graphName: 'custom',
            model: 'gpt-4o',
            temperature: 0.5,
          },
        }),
      )

      expect(factory).toHaveBeenCalledWith({
        model: 'gpt-4o',
        temperature: 0.5,
      })
    })

    it('throws for missing graphName', async () => {
      await expect(
        executor.execute(makePayload({ executorConfig: {} })),
      ).rejects.toThrow(/graphName is required/)
    })

    it('throws for unregistered graph', async () => {
      await expect(
        executor.execute(
          makePayload({ executorConfig: { graphName: 'unknown' } }),
        ),
      ).rejects.toThrow(/no graph registered for "unknown"/)
    })

    it('uses deterministic thread ID from workflowRunId:stepName', async () => {
      await executor.execute(
        makePayload({ workflowRunId: 'wf-123', stepName: 'plan' }),
      )

      expect(mockGraph._compiled.invoke).toHaveBeenCalledWith(
        expect.anything(),
        { configurable: { thread_id: 'wf-123:plan' } },
      )
    })

    it('handles already-compiled graphs', async () => {
      const preCompiled = {
        invoke: vi.fn().mockResolvedValue({ precompiled: true }),
        getState: vi.fn().mockResolvedValue({ next: [] }),
      }
      executor.registerGraph('precompiled', () => preCompiled)

      const result = await executor.execute(
        makePayload({ executorConfig: { graphName: 'precompiled' } }),
      )

      expect(result.output).toEqual({ precompiled: true })
    })

    it('returns input data in output', async () => {
      const data = { complex: { nested: true }, array: [1, 2] }
      mockGraph = createMockGraph(data)
      executor = new LangGraphStepExecutor({
        graphs: new Map([['testGraph', () => mockGraph]]),
      })

      const result = await executor.execute(makePayload())
      expect(result.output).toEqual(data)
    })
  })

  describe('graph management', () => {
    it('registers graphs at runtime', () => {
      executor.registerGraph('newGraph', () => createMockGraph({ new: true }))
      expect(executor.listGraphs()).toContain('newGraph')
    })

    it('unregisters graphs', () => {
      executor.registerGraph('temp', () => createMockGraph({}))
      expect(executor.unregisterGraph('temp')).toBe(true)
      expect(executor.listGraphs()).not.toContain('temp')
    })

    it('returns false when unregistering nonexistent graph', () => {
      expect(executor.unregisterGraph('nonexistent')).toBe(false)
    })

    it('lists all registered graphs', () => {
      expect(executor.listGraphs()).toEqual(['testGraph'])
    })
  })

  describe('human interrupt detection', () => {
    it('detects pending nodes as human interrupt (with checkpointer)', async () => {
      // Simulate having a checkpointer
      const humanGraph = createMockGraph(
        { analysis: 'done', __humanPrompt: 'Please review the analysis' },
        { pendingNodes: true },
      )

      const exec = new LangGraphStepExecutor({
        graphs: new Map([['humanGraph', () => humanGraph]]),
      })
      // Manually set checkpointer to enable interrupt detection
      ;(exec as any).checkpointer = {}

      const result = await exec.execute(
        makePayload({ executorConfig: { graphName: 'humanGraph' } }),
      )

      expect(result.waitForHuman).toBeDefined()
      expect(result.waitForHuman!.prompt).toBe('Please review the analysis')
    })

    it('no waitForHuman when no pending nodes', async () => {
      const exec = new LangGraphStepExecutor({
        graphs: new Map([['testGraph', () => mockGraph]]),
      })
      ;(exec as any).checkpointer = {}

      const result = await exec.execute(makePayload())

      expect(result.waitForHuman).toBeUndefined()
    })

    it('no interrupt check without checkpointer', async () => {
      // Default: no checkpointer
      const result = await executor.execute(makePayload())
      expect(result.waitForHuman).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('propagates graph execution errors', async () => {
      const failingGraph = {
        compile: vi.fn().mockReturnValue({
          invoke: vi.fn().mockRejectedValue(new Error('LLM rate limit')),
        }),
      }
      executor.registerGraph('failing', () => failingGraph)

      await expect(
        executor.execute(
          makePayload({ executorConfig: { graphName: 'failing' } }),
        ),
      ).rejects.toThrow('LLM rate limit')
    })
  })
})

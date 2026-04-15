// npx vitest run src/__tests__/workflow-builder.spec.ts
import { describe, expect, it } from 'vitest'
import { DAGValidationError } from '../errors/WorkflowErrors.js'
import { WorkflowBuilder } from '../workflow/WorkflowBuilder.js'

describe('WorkflowBuilder', () => {
  describe('valid workflows', () => {
    it('builds a single step workflow', () => {
      const wf = WorkflowBuilder.create('test')
        .step('only', {
          executorType: 'function',
          executorConfig: { handler: 'echo' },
        })
        .build()

      expect(wf.name).toBe('test')
      expect(wf.steps).toHaveLength(1)
      expect(wf.steps[0].name).toBe('only')
    })

    it('builds a linear chain', () => {
      const wf = WorkflowBuilder.create('linear')
        .step('a', { executorType: 'function', executorConfig: {} })
        .step('b', {
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        })
        .step('c', {
          dependsOn: ['b'],
          executorType: 'function',
          executorConfig: {},
        })
        .build()

      expect(wf.steps).toHaveLength(3)
    })

    it('builds a diamond DAG', () => {
      const wf = WorkflowBuilder.create('diamond')
        .step('root', { executorType: 'function', executorConfig: {} })
        .step('left', {
          dependsOn: ['root'],
          executorType: 'function',
          executorConfig: {},
        })
        .step('right', {
          dependsOn: ['root'],
          executorType: 'function',
          executorConfig: {},
        })
        .step('join', {
          dependsOn: ['left', 'right'],
          executorType: 'function',
          executorConfig: {},
        })
        .build()

      expect(wf.steps).toHaveLength(4)
    })

    it('builds fan-out workflow', () => {
      const wf = WorkflowBuilder.create('fanout')
        .step('source', { executorType: 'function', executorConfig: {} })
        .step('branch1', {
          dependsOn: ['source'],
          executorType: 'function',
          executorConfig: {},
        })
        .step('branch2', {
          dependsOn: ['source'],
          executorType: 'function',
          executorConfig: {},
        })
        .step('branch3', {
          dependsOn: ['source'],
          executorType: 'function',
          executorConfig: {},
        })
        .build()

      expect(wf.steps).toHaveLength(4)
    })
  })

  describe('builder API', () => {
    it('sets version', () => {
      const wf = WorkflowBuilder.create('test')
        .version('2.0.0')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.version).toBe('2.0.0')
    })

    it('defaults version to 1.0.0', () => {
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.version).toBe('1.0.0')
    })

    it('sets defaultRetries', () => {
      const wf = WorkflowBuilder.create('test')
        .defaultRetries(5)
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.defaultRetries).toBe(5)
    })

    it('defaults retries to 3', () => {
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.defaultRetries).toBe(3)
    })

    it('sets defaultTimeout', () => {
      const wf = WorkflowBuilder.create('test')
        .defaultTimeout(60_000)
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.defaultTimeoutMs).toBe(60_000)
    })

    it('sets failFast', () => {
      const wf = WorkflowBuilder.create('test')
        .failFast()
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.failFast).toBe(true)
    })

    it('registers signal handlers', () => {
      const handler = async () => {}
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .onSignal('approve', handler)
        .build()

      expect(wf.signals).toBeDefined()
      expect(wf.signals!.approve).toBeDefined()
    })

    it('registers query handlers', () => {
      const handler = () => ({ progress: 50 })
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .onQuery('progress', handler)
        .build()

      expect(wf.queries).toBeDefined()
      expect(wf.queries!.progress).toBeDefined()
    })

    it('registers onComplete callback', () => {
      const fn = async () => {}
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .onComplete(fn)
        .build()

      expect(wf.onComplete).toBe(fn)
    })

    it('registers onFail callback', () => {
      const fn = async () => {}
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .onFail(fn)
        .build()

      expect(wf.onFail).toBe(fn)
    })

    it('preserves step config', () => {
      const condition = () => true
      const mapInput = () => ({ mapped: true })

      const wf = WorkflowBuilder.create('test')
        .step('a', {
          executorType: 'langgraph',
          executorConfig: { graphName: 'test' },
          retries: 5,
          timeoutMs: 10_000,
          requiresHumanApproval: true,
          condition,
          mapInput,
        })
        .build()

      const step = wf.steps[0]
      expect(step.executorType).toBe('langgraph')
      expect(step.executorConfig).toEqual({ graphName: 'test' })
      expect(step.retries).toBe(5)
      expect(step.timeoutMs).toBe(10_000)
      expect(step.requiresHumanApproval).toBe(true)
      expect(step.condition).toBe(condition)
      expect(step.mapInput).toBe(mapInput)
    })

    it('defaults durability to undefined (= buffered)', () => {
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.durability).toBeUndefined()
    })

    it('sets durability to "committed"', () => {
      const wf = WorkflowBuilder.create('payment')
        .durability('committed')
        .step('charge', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.durability).toBe('committed')
    })

    it('sets durability to "buffered" explicitly', () => {
      const wf = WorkflowBuilder.create('event')
        .durability('buffered')
        .step('process', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf.durability).toBe('buffered')
    })

    it('returns immutable steps array', () => {
      const wf = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      // Mutating the returned array should not affect original
      wf.steps.push({ name: 'hacked', executorType: 'x', executorConfig: {} })

      const wf2 = WorkflowBuilder.create('test')
        .step('a', { executorType: 'function', executorConfig: {} })
        .build()

      expect(wf2.steps).toHaveLength(1)
    })
  })

  describe('DAG validation', () => {
    it('rejects empty workflow name', () => {
      expect(() =>
        WorkflowBuilder.create('')
          .step('a', { executorType: 'function', executorConfig: {} })
          .build(),
      ).toThrow(DAGValidationError)
    })

    it('rejects workflow with no steps', () => {
      expect(() => WorkflowBuilder.create('test').build()).toThrow(
        DAGValidationError,
      )
    })

    it('rejects duplicate step names', () => {
      expect(() =>
        WorkflowBuilder.create('test')
          .step('a', { executorType: 'function', executorConfig: {} })
          .step('a', { executorType: 'function', executorConfig: {} })
          .build(),
      ).toThrow(/Duplicate step name/)
    })

    it('rejects missing dependency reference', () => {
      expect(() =>
        WorkflowBuilder.create('test')
          .step('a', {
            dependsOn: ['nonexistent'],
            executorType: 'function',
            executorConfig: {},
          })
          .build(),
      ).toThrow(/unknown step "nonexistent"/)
    })

    it('rejects self-dependency', () => {
      expect(() =>
        WorkflowBuilder.create('test')
          .step('a', {
            dependsOn: ['a'],
            executorType: 'function',
            executorConfig: {},
          })
          .build(),
      ).toThrow(/depends on itself/)
    })

    it('rejects cycle (A→B→A)', () => {
      expect(() =>
        WorkflowBuilder.create('test')
          .step('a', {
            dependsOn: ['b'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('b', {
            dependsOn: ['a'],
            executorType: 'function',
            executorConfig: {},
          })
          .build(),
      ).toThrow(/Cycle detected/)
    })

    it('rejects longer cycle (A→B→C→A)', () => {
      expect(() =>
        WorkflowBuilder.create('test')
          .step('a', {
            dependsOn: ['c'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('b', {
            dependsOn: ['a'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('c', {
            dependsOn: ['b'],
            executorType: 'function',
            executorConfig: {},
          })
          .build(),
      ).toThrow(/Cycle detected/)
    })

    it('accepts valid complex graph', () => {
      expect(() =>
        WorkflowBuilder.create('complex')
          .step('a', { executorType: 'function', executorConfig: {} })
          .step('b', {
            dependsOn: ['a'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('c', {
            dependsOn: ['a'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('d', {
            dependsOn: ['b', 'c'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('e', {
            dependsOn: ['c'],
            executorType: 'function',
            executorConfig: {},
          })
          .step('f', {
            dependsOn: ['d', 'e'],
            executorType: 'function',
            executorConfig: {},
          })
          .build(),
      ).not.toThrow()
    })
  })
})

// npx vitest run src/__tests__/state-machine.spec.ts
import { describe, expect, it } from 'vitest'
import {
  canStepTransition,
  canWorkflowTransition,
  deriveWorkflowStatus,
  getReadySteps,
  isTerminalStepStatus,
  isTerminalWorkflowStatus,
  topologicalSort,
} from '../state/WorkflowStateMachine.js'
import type { StepStatus } from '../workflow/WorkflowBuilder.types.js'

describe('WorkflowStateMachine', () => {
  describe('canWorkflowTransition', () => {
    it('allows PENDING → RUNNING', () => {
      expect(canWorkflowTransition('PENDING', 'RUNNING')).toBe(true)
    })

    it('allows PENDING → CANCELLED', () => {
      expect(canWorkflowTransition('PENDING', 'CANCELLED')).toBe(true)
    })

    it('allows RUNNING → COMPLETED', () => {
      expect(canWorkflowTransition('RUNNING', 'COMPLETED')).toBe(true)
    })

    it('allows RUNNING → FAILED', () => {
      expect(canWorkflowTransition('RUNNING', 'FAILED')).toBe(true)
    })

    it('allows RUNNING → WAITING_HUMAN', () => {
      expect(canWorkflowTransition('RUNNING', 'WAITING_HUMAN')).toBe(true)
    })

    it('allows RUNNING → CANCELLED', () => {
      expect(canWorkflowTransition('RUNNING', 'CANCELLED')).toBe(true)
    })

    it('allows WAITING_HUMAN → RUNNING', () => {
      expect(canWorkflowTransition('WAITING_HUMAN', 'RUNNING')).toBe(true)
    })

    it('allows WAITING_HUMAN → CANCELLED', () => {
      expect(canWorkflowTransition('WAITING_HUMAN', 'CANCELLED')).toBe(true)
    })

    it('rejects COMPLETED → anything', () => {
      expect(canWorkflowTransition('COMPLETED', 'RUNNING')).toBe(false)
      expect(canWorkflowTransition('COMPLETED', 'FAILED')).toBe(false)
      expect(canWorkflowTransition('COMPLETED', 'PENDING')).toBe(false)
    })

    it('rejects FAILED → anything', () => {
      expect(canWorkflowTransition('FAILED', 'RUNNING')).toBe(false)
      expect(canWorkflowTransition('FAILED', 'COMPLETED')).toBe(false)
    })

    it('rejects CANCELLED → anything', () => {
      expect(canWorkflowTransition('CANCELLED', 'RUNNING')).toBe(false)
    })

    it('rejects PENDING → COMPLETED (must go through RUNNING)', () => {
      expect(canWorkflowTransition('PENDING', 'COMPLETED')).toBe(false)
    })

    it('rejects PENDING → FAILED', () => {
      expect(canWorkflowTransition('PENDING', 'FAILED')).toBe(false)
    })
  })

  describe('canStepTransition', () => {
    it('allows PENDING → QUEUED', () => {
      expect(canStepTransition('PENDING', 'QUEUED')).toBe(true)
    })

    it('allows PENDING → SKIPPED', () => {
      expect(canStepTransition('PENDING', 'SKIPPED')).toBe(true)
    })

    it('allows QUEUED → RUNNING', () => {
      expect(canStepTransition('QUEUED', 'RUNNING')).toBe(true)
    })

    it('allows RUNNING → COMPLETED', () => {
      expect(canStepTransition('RUNNING', 'COMPLETED')).toBe(true)
    })

    it('allows RUNNING → FAILED', () => {
      expect(canStepTransition('RUNNING', 'FAILED')).toBe(true)
    })

    it('allows RUNNING → WAITING_HUMAN', () => {
      expect(canStepTransition('RUNNING', 'WAITING_HUMAN')).toBe(true)
    })

    it('allows FAILED → QUEUED (retry)', () => {
      expect(canStepTransition('FAILED', 'QUEUED')).toBe(true)
    })

    it('allows WAITING_HUMAN → QUEUED (resume)', () => {
      expect(canStepTransition('WAITING_HUMAN', 'QUEUED')).toBe(true)
    })

    it('rejects COMPLETED → anything', () => {
      expect(canStepTransition('COMPLETED', 'QUEUED')).toBe(false)
      expect(canStepTransition('COMPLETED', 'RUNNING')).toBe(false)
    })

    it('rejects SKIPPED → anything', () => {
      expect(canStepTransition('SKIPPED', 'QUEUED')).toBe(false)
    })
  })

  describe('isTerminalWorkflowStatus', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminalWorkflowStatus('COMPLETED')).toBe(true)
    })

    it('FAILED is terminal', () => {
      expect(isTerminalWorkflowStatus('FAILED')).toBe(true)
    })

    it('CANCELLED is terminal', () => {
      expect(isTerminalWorkflowStatus('CANCELLED')).toBe(true)
    })

    it('RUNNING is not terminal', () => {
      expect(isTerminalWorkflowStatus('RUNNING')).toBe(false)
    })

    it('PENDING is not terminal', () => {
      expect(isTerminalWorkflowStatus('PENDING')).toBe(false)
    })

    it('WAITING_HUMAN is not terminal', () => {
      expect(isTerminalWorkflowStatus('WAITING_HUMAN')).toBe(false)
    })
  })

  describe('isTerminalStepStatus', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminalStepStatus('COMPLETED')).toBe(true)
    })

    it('FAILED is not terminal (can retry)', () => {
      expect(isTerminalStepStatus('FAILED')).toBe(false)
    })

    it('SKIPPED is terminal', () => {
      expect(isTerminalStepStatus('SKIPPED')).toBe(true)
    })
  })

  describe('deriveWorkflowStatus', () => {
    it('returns COMPLETED when all steps COMPLETED', () => {
      expect(
        deriveWorkflowStatus([
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
        ]),
      ).toBe('COMPLETED')
    })

    it('returns COMPLETED when all steps COMPLETED or SKIPPED', () => {
      expect(
        deriveWorkflowStatus([{ status: 'COMPLETED' }, { status: 'SKIPPED' }]),
      ).toBe('COMPLETED')
    })

    it('returns COMPLETED for empty step list', () => {
      expect(deriveWorkflowStatus([])).toBe('COMPLETED')
    })

    it('returns RUNNING when any step QUEUED', () => {
      expect(
        deriveWorkflowStatus([{ status: 'COMPLETED' }, { status: 'QUEUED' }]),
      ).toBe('RUNNING')
    })

    it('returns RUNNING when any step RUNNING', () => {
      expect(
        deriveWorkflowStatus([{ status: 'COMPLETED' }, { status: 'RUNNING' }]),
      ).toBe('RUNNING')
    })

    it('returns WAITING_HUMAN when any step WAITING_HUMAN', () => {
      expect(
        deriveWorkflowStatus([
          { status: 'COMPLETED' },
          { status: 'WAITING_HUMAN' },
        ]),
      ).toBe('WAITING_HUMAN')
    })

    it('WAITING_HUMAN takes priority over RUNNING', () => {
      expect(
        deriveWorkflowStatus([
          { status: 'RUNNING' },
          { status: 'WAITING_HUMAN' },
        ]),
      ).toBe('WAITING_HUMAN')
    })

    it('returns FAILED when step FAILED and nothing active', () => {
      expect(
        deriveWorkflowStatus([{ status: 'COMPLETED' }, { status: 'FAILED' }]),
      ).toBe('FAILED')
    })

    it('returns RUNNING when step FAILED but others still active', () => {
      expect(
        deriveWorkflowStatus([{ status: 'RUNNING' }, { status: 'FAILED' }]),
      ).toBe('RUNNING')
    })

    it('returns RUNNING when some PENDING, some COMPLETED', () => {
      expect(
        deriveWorkflowStatus([{ status: 'COMPLETED' }, { status: 'PENDING' }]),
      ).toBe('RUNNING')
    })
  })

  describe('getReadySteps', () => {
    it('returns root steps (no deps) when PENDING', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        {
          name: 'b',
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        a: 'PENDING' as StepStatus,
        b: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses)).toEqual(['a'])
    })

    it('returns step when all deps COMPLETED', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        {
          name: 'b',
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        a: 'COMPLETED' as StepStatus,
        b: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses)).toEqual(['b'])
    })

    it('returns step when dep SKIPPED', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        {
          name: 'b',
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        a: 'SKIPPED' as StepStatus,
        b: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses)).toEqual(['b'])
    })

    it('does NOT return step when dep RUNNING', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        {
          name: 'b',
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        a: 'RUNNING' as StepStatus,
        b: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses)).toEqual([])
    })

    it('does NOT return step when dep FAILED', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        {
          name: 'b',
          dependsOn: ['a'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = { a: 'FAILED' as StepStatus, b: 'PENDING' as StepStatus }
      expect(getReadySteps(steps, statuses)).toEqual([])
    })

    it('returns multiple ready steps (fan-out)', () => {
      const steps = [
        { name: 'root', executorType: 'function', executorConfig: {} },
        {
          name: 'left',
          dependsOn: ['root'],
          executorType: 'function',
          executorConfig: {},
        },
        {
          name: 'right',
          dependsOn: ['root'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        root: 'COMPLETED' as StepStatus,
        left: 'PENDING' as StepStatus,
        right: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses).sort()).toEqual(['left', 'right'])
    })

    it('requires ALL deps completed for fan-in', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
        { name: 'b', executorType: 'function', executorConfig: {} },
        {
          name: 'join',
          dependsOn: ['a', 'b'],
          executorType: 'function',
          executorConfig: {},
        },
      ]
      const statuses = {
        a: 'COMPLETED' as StepStatus,
        b: 'RUNNING' as StepStatus,
        join: 'PENDING' as StepStatus,
      }
      expect(getReadySteps(steps, statuses)).toEqual([])
    })

    it('does not return already QUEUED steps', () => {
      const steps = [
        { name: 'a', executorType: 'function', executorConfig: {} },
      ]
      const statuses = { a: 'QUEUED' as StepStatus }
      expect(getReadySteps(steps, statuses)).toEqual([])
    })
  })

  describe('topologicalSort', () => {
    it('sorts linear chain correctly', () => {
      const steps = [
        { name: 'c', dependsOn: ['b'], executorType: 'f', executorConfig: {} },
        { name: 'a', executorType: 'f', executorConfig: {} },
        { name: 'b', dependsOn: ['a'], executorType: 'f', executorConfig: {} },
      ]
      const sorted = topologicalSort(steps)
      expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'))
      expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'))
    })

    it('handles diamond DAG', () => {
      const steps = [
        { name: 'root', executorType: 'f', executorConfig: {} },
        {
          name: 'left',
          dependsOn: ['root'],
          executorType: 'f',
          executorConfig: {},
        },
        {
          name: 'right',
          dependsOn: ['root'],
          executorType: 'f',
          executorConfig: {},
        },
        {
          name: 'join',
          dependsOn: ['left', 'right'],
          executorType: 'f',
          executorConfig: {},
        },
      ]
      const sorted = topologicalSort(steps)
      expect(sorted[0]).toBe('root')
      expect(sorted[3]).toBe('join')
    })

    it('detects simple cycle', () => {
      const steps = [
        { name: 'a', dependsOn: ['b'], executorType: 'f', executorConfig: {} },
        { name: 'b', dependsOn: ['a'], executorType: 'f', executorConfig: {} },
      ]
      expect(() => topologicalSort(steps)).toThrow(/Cycle detected/)
    })

    it('detects self-referencing cycle', () => {
      const steps = [
        { name: 'a', dependsOn: ['a'], executorType: 'f', executorConfig: {} },
      ]
      expect(() => topologicalSort(steps)).toThrow(/Cycle detected/)
    })

    it('handles single step', () => {
      const steps = [{ name: 'only', executorType: 'f', executorConfig: {} }]
      expect(topologicalSort(steps)).toEqual(['only'])
    })

    it('handles independent steps', () => {
      const steps = [
        { name: 'a', executorType: 'f', executorConfig: {} },
        { name: 'b', executorType: 'f', executorConfig: {} },
        { name: 'c', executorType: 'f', executorConfig: {} },
      ]
      const sorted = topologicalSort(steps)
      expect(sorted).toHaveLength(3)
      expect(new Set(sorted)).toEqual(new Set(['a', 'b', 'c']))
    })
  })
})

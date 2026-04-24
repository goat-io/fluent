// npx vitest run src/__tests__/dispatcher/workflow-schedule.spec.ts
//
// Pure unit tests for the `schedule` property on Workflow subclasses.
// Verifies that toDefinition() correctly serializes schedule metadata
// (pattern, input, environments, tenants) — or omits it when absent.

import { describe, expect, it } from 'vitest'
import { Step } from '../../workflow/Step.js'
import { step, Workflow } from '../../workflow/Workflow.js'

// ── Test fixtures ────────────────────────────────────────────────────

class TestStep extends Step<{ x: number }, { y: number }> {
  stepName = 'test_step' as const
  executorType = 'function' as const

  async handle(input: { x: number }) {
    return { output: { y: input.x + 1 } }
  }
}

const testStep = new TestStep()

// ── Tests ────────────────────────────────────────────────────────────

describe('Workflow schedule property', () => {
  it('compiles toDefinition() correctly when schedule is defined', () => {
    class ScheduledWorkflow extends Workflow<{ x: number }> {
      workflowName = 'scheduled_wf' as const
      schedule = {
        cron: '0 6 * * *',
        input: { x: 42 },
        environments: ['production'],
        tenants: ['acme'],
      }

      steps = [step(testStep)] as const
    }

    const def = new ScheduledWorkflow().toDefinition()

    expect(def.schedule).toBeDefined()
    expect(def.schedule).toEqual({
      cron: '0 6 * * *',
      input: { x: 42 },
      environments: ['production'],
      tenants: ['acme'],
    })
  })

  it('has undefined schedule in definition when not declared', () => {
    class NoScheduleWorkflow extends Workflow<{ x: number }> {
      workflowName = 'no_schedule_wf' as const
      steps = [step(testStep)] as const
    }

    const def = new NoScheduleWorkflow().toDefinition()

    expect(def.schedule).toBeUndefined()
  })

  it('includes schedule.pattern in definition', () => {
    class PatternOnly extends Workflow<{ x: number }> {
      workflowName = 'pattern_only' as const
      schedule = { cron: '*/15 * * * *' }
      steps = [step(testStep)] as const
    }

    const def = new PatternOnly().toDefinition()

    expect(def.schedule).toBeDefined()
    expect(def.schedule!.cron).toBe('*/15 * * * *')
  })

  it('includes schedule.input in definition', () => {
    class WithInput extends Workflow<{ x: number }> {
      workflowName = 'with_input' as const
      schedule = {
        cron: '0 0 * * *',
        input: { x: 99 },
      }
      steps = [step(testStep)] as const
    }

    const def = new WithInput().toDefinition()

    expect(def.schedule!.input).toEqual({ x: 99 })
  })

  it('includes schedule.environments in definition', () => {
    class WithEnvs extends Workflow<{ x: number }> {
      workflowName = 'with_envs' as const
      schedule = {
        cron: '0 3 * * 0',
        environments: ['staging', 'production'],
      }
      steps = [step(testStep)] as const
    }

    const def = new WithEnvs().toDefinition()

    expect(def.schedule!.environments).toEqual(['staging', 'production'])
  })

  it('includes schedule.tenants in definition', () => {
    class WithTenants extends Workflow<{ x: number }> {
      workflowName = 'with_tenants' as const
      schedule = {
        cron: '0 12 * * 1-5',
        tenants: ['tenant-a', 'tenant-b'],
      }
      steps = [step(testStep)] as const
    }

    const def = new WithTenants().toDefinition()

    expect(def.schedule!.tenants).toEqual(['tenant-a', 'tenant-b'])
  })
})

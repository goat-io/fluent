// npx vitest run src/__tests__/dispatcher/type-safety.spec.ts
//
// Type-level tests: verifies WorkflowsApi isolates types per workflow.
// One Workflow<any> must NOT poison other workflows' input types.

import { describe, expect, expectTypeOf, it } from 'vitest'
import type { TypedEngine } from '../../workflow/createEngine.js'
import { createEngine } from '../../workflow/createEngine.js'
import { FunctionStep } from '../../workflow/Step.js'
import { Workflow } from '../../workflow/Workflow.js'

// ── Test workflows ──────────────────────────────────────────────────

class StepA extends FunctionStep<{ x: number }, { y: number }> {
  stepName = 'step_a' as const
  async handle(input: { x: number }) {
    return { output: { y: input.x + 1 } }
  }
}

class TypedWorkflow extends Workflow<{ x: number }> {
  workflowName = 'typed_wf' as const
  steps = [new StepA()] as const
}

class AnyWorkflow extends Workflow<any> {
  workflowName = 'any_wf' as const
  steps = [new StepA()] as const
}

class AnotherTyped extends Workflow<{ name: string }> {
  workflowName = 'another_typed' as const
  steps = [new StepA()] as const
}

// ── Helpers ─────────────────────────────────────────────────────────

const mockDb = {
  query: async () => ({ rows: [] }),
  transaction: async (fn: any) => fn({ query: async () => ({ rows: [] }) }),
  getPool: () => ({ connect: () => {}, end: () => {}, on: () => {} }),
} as any

// ── Tests ───────────────────────────────────────────────────────────

describe('WorkflowsApi type isolation', () => {
  it('engine has typed workflow names as properties', () => {
    const engine = createEngine({
      database: mockDb,
      workflows: [new TypedWorkflow()] as const,
      tenantId: 'test',
    })

    expect(engine.typed_wf).toBeDefined()
    expect(engine.typedWf).toBeDefined()
    expect(typeof engine.typed_wf.start).toBe('function')
  })

  it('Workflow<any> does NOT poison other workflows input types', () => {
    const engine = createEngine({
      database: mockDb,
      workflows: [
        new TypedWorkflow(),
        new AnyWorkflow(),
        new AnotherTyped(),
      ] as const,
      tenantId: 'test',
    })

    // Runtime: all three exist
    expect(engine.typed_wf).toBeDefined()
    expect(engine.any_wf).toBeDefined()
    expect(engine.another_typed).toBeDefined()

    // Type-level: typed_wf input should be { x: number }, NOT any
    type TypedInput = Parameters<typeof engine.typed_wf.start>[0]
    type AnotherInput = Parameters<typeof engine.another_typed.start>[0]

    // These compile — correct types
    const _validTyped: TypedInput = { x: 42 }
    const _validAnother: AnotherInput = { name: 'test' }

    // If types are correct, these would fail at compile time.
    // We use expectTypeOf for compile-time assertions.
    expectTypeOf<TypedInput>().toMatchTypeOf<{ x: number }>()
    expectTypeOf<AnotherInput>().toMatchTypeOf<{ name: string }>()

    // Verify they are NOT any
    expectTypeOf<TypedInput>().not.toBeAny()
    expectTypeOf<AnotherInput>().not.toBeAny()
  })

  it('TypedEngine preserves per-workflow input types with any in tuple', () => {
    // Explicitly test through the TypedEngine type (same path as sodium)
    type Instances = readonly [TypedWorkflow, AnyWorkflow, AnotherTyped]
    type Engine = TypedEngine<Instances>

    // Workflow names exist
    expectTypeOf<Engine['typed_wf']>().not.toBeAny()
    expectTypeOf<Engine['another_typed']>().not.toBeAny()

    // Input types preserved
    type TI = Parameters<Engine['typed_wf']['start']>[0]
    type AI = Parameters<Engine['another_typed']['start']>[0]

    expectTypeOf<TI>().not.toBeAny()
    expectTypeOf<AI>().not.toBeAny()
    expectTypeOf<TI>().toMatchTypeOf<{ x: number }>()
    expectTypeOf<AI>().toMatchTypeOf<{ name: string }>()
  })

  it('camelCase aliases also preserve types', () => {
    type Instances = readonly [TypedWorkflow, AnyWorkflow, AnotherTyped]
    type Engine = TypedEngine<Instances>

    type CamelInput = Parameters<Engine['typedWf']['start']>[0]
    type CamelAnother = Parameters<Engine['anotherTyped']['start']>[0]

    expectTypeOf<CamelInput>().not.toBeAny()
    expectTypeOf<CamelAnother>().not.toBeAny()
  })
})

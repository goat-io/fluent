// npx vitest run src/__tests__/outcome-and-loop.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { InMemoryBrainClient } from '../BrainClient.js'
import { CompileRegistry } from '../CompileRegistry.js'
import { createGovernance } from '../createGovernance.js'
import { createOutcomeSubscriber } from '../OutcomeSubscriber.js'
import type { Action } from '../types.js'
import { fromEngine } from '../WorkflowStarter.js'

describe('OutcomeSubscriber — the Measure seam', () => {
  it('records an outcome for a governance-originated run.completed', () => {
    const recorded: unknown[] = []
    const onEngineEvent = createOutcomeSubscriber({
      recorder: { record: o => void recorded.push(o) },
      now: () => '2026-06-07T00:00:00.000Z',
    })

    onEngineEvent({
      type: 'run.completed',
      runId: 'run_1',
      traceId: 'decision:aws-cost-cut-aurora',
      status: 'COMPLETED',
      output: { saved: 1200 },
    })

    expect(recorded).toEqual([
      {
        itemName: 'aws-cost-cut-aurora',
        runId: 'run_1',
        traceId: 'decision:aws-cost-cut-aurora',
        workflowName: undefined,
        status: 'COMPLETED',
        output: { saved: 1200 },
        error: undefined,
        recordedAt: '2026-06-07T00:00:00.000Z',
      },
    ])
  })

  it('ignores non-run.completed events and non-governance trace ids', () => {
    const record = vi.fn()
    const onEngineEvent = createOutcomeSubscriber({ recorder: { record } })

    onEngineEvent({ type: 'step.completed', runId: 'r', traceId: 'decision:x' })
    onEngineEvent({
      type: 'run.completed',
      runId: 'r',
      traceId: 'some-other-trace',
      status: 'COMPLETED',
    })

    expect(record).not.toHaveBeenCalled()
  })

  it('never throws back into the engine when the recorder fails', () => {
    const onEngineEvent = createOutcomeSubscriber({
      recorder: {
        record: () => {
          throw new Error('sink down')
        },
      },
    })

    expect(() =>
      onEngineEvent({
        type: 'run.completed',
        runId: 'r',
        traceId: 'decision:x',
        status: 'FAILED',
        error: 'boom',
      }),
    ).not.toThrow()
  })
})

describe('fromEngine adapter', () => {
  it('routes start() to the named workflow ops with input + opts', async () => {
    const start = vi.fn(async () => ({ runId: 'run_42' }))
    const engine = { awsCostCut: { start } }
    const starter = fromEngine(engine)

    const res = await starter.start({
      workflowName: 'awsCostCut',
      input: { cluster: 'c1' },
      idempotencyKey: 'k',
      traceId: 'decision:k',
    })

    expect(res).toEqual({ runId: 'run_42', traceId: 'decision:k' })
    expect(start).toHaveBeenCalledWith(
      { cluster: 'c1' },
      { idempotencyKey: 'k', traceId: 'decision:k' },
    )
  })

  it('throws for an unknown workflow name', async () => {
    const starter = fromEngine({})
    await expect(
      starter.start({ workflowName: 'nope', input: {} }),
    ).rejects.toThrow(/no startable workflow named 'nope'/)
  })
})

describe('createGovernance — full loop: compile → run → measure', () => {
  it('compiles an approved action, then records its outcome back to the Brain', async () => {
    const action: Action = {
      name: 'aws-cost-cut-aurora',
      kind: 'action',
      description: 'Delete idle Aurora cluster.',
      type: 'cost-cut',
      status: 'proposed',
      target: 'person-service-aurora',
    }
    const brain = new InMemoryBrainClient({ actions: [action] })

    // A fake engine: one workflow that "runs" and reports completion.
    const started: Array<{ traceId?: string }> = []
    const engine = {
      awsCostCut: {
        start: async (
          _input: object,
          opts?: { idempotencyKey?: string; traceId?: string },
        ) => {
          started.push({ traceId: opts?.traceId })
          return { runId: 'run_1' }
        },
      },
    }

    const governance = createGovernance({
      brain,
      starter: fromEngine(engine),
      registry: new CompileRegistry().register('cost-cut', {
        workflowName: 'awsCostCut',
        mapInput: a => ({ cluster: a.target }),
      }),
      now: () => '2026-06-07T00:00:00.000Z',
    })

    // 1. Compile approved actions into runs.
    const results = await governance.tick()
    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('executing')
    expect(results[0]?.traceId).toBe('decision:aws-cost-cut-aurora')

    // 2. Engine finishes → fires run.completed → governance records the outcome.
    governance.onEngineEvent({
      type: 'run.completed',
      runId: 'run_1',
      traceId: started[0]?.traceId as string,
      status: 'COMPLETED',
      output: { saved: 1200 },
    })

    // Outcome linked back to the originating action by name.
    expect(brain.outcomes).toHaveLength(1)
    expect(brain.outcomes[0]).toMatchObject({
      itemName: 'aws-cost-cut-aurora',
      runId: 'run_1',
      status: 'COMPLETED',
      output: { saved: 1200 },
      recordedAt: '2026-06-07T00:00:00.000Z',
    })
  })
})

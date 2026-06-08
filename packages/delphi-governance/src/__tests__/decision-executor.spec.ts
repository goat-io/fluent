// npx vitest run src/__tests__/decision-executor.spec.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryBrainClient } from '../BrainClient.js'
import { CompileRegistry } from '../CompileRegistry.js'
import { DefaultConstitutionGuard } from '../ConstitutionGuard.js'
import { DecisionExecutor } from '../DecisionExecutor.js'
import type { Action, Classification } from '../types.js'
import type { StartRequest, WorkflowStarter } from '../WorkflowStarter.js'

function recordingStarter(): WorkflowStarter & { calls: StartRequest[] } {
  const calls: StartRequest[] = []
  let n = 0
  return {
    calls,
    async start(req) {
      calls.push(req)
      n += 1
      return { runId: `run_${n}`, traceId: req.traceId }
    },
  }
}

const costCutAction: Action = {
  name: 'aws-cost-cut-aurora',
  kind: 'action',
  description: 'Delete idle Aurora cluster.',
  type: 'cost-cut',
  status: 'proposed',
  target: 'person-service-aurora',
}

describe('DecisionExecutor — compile Action → workflow', () => {
  let starter: ReturnType<typeof recordingStarter>
  let registry: CompileRegistry

  beforeEach(() => {
    starter = recordingStarter()
    registry = new CompileRegistry().register('cost-cut', {
      workflowName: 'awsCostCut',
      mapInput: a => ({ cluster: a.target }),
    })
  })

  it('compiles an allowed action into an exactly-once workflow start', async () => {
    const exec = new DecisionExecutor({
      starter,
      registry,
      guard: new DefaultConstitutionGuard(),
    })

    const result = await exec.execute(costCutAction)

    expect(result.status).toBe('executing')
    expect(result.runId).toBe('run_1')
    expect(result.workflowName).toBe('awsCostCut')
    // idempotencyKey = action name → re-runs never double-execute
    expect(starter.calls).toHaveLength(1)
    expect(starter.calls[0]).toMatchObject({
      workflowName: 'awsCostCut',
      input: { cluster: 'person-service-aurora' },
      idempotencyKey: 'aws-cost-cut-aurora',
      traceId: 'decision:aws-cost-cut-aurora',
    })
  })

  it('returns no_rule when no compile rule matches the action type', async () => {
    const exec = new DecisionExecutor({
      starter,
      registry: new CompileRegistry(),
      guard: new DefaultConstitutionGuard(),
    })

    const result = await exec.execute(costCutAction)

    expect(result.status).toBe('no_rule')
    expect(starter.calls).toHaveLength(0)
  })

  it('blocks execution when a constraint severity is in blockSeverities', async () => {
    const lifeSafety: Classification = {
      name: 'life-safety',
      kind: 'classification',
      description: 'Harm if mishandled.',
      severity: 'highest',
    }
    const brain = new InMemoryBrainClient({ classifications: [lifeSafety] })
    const exec = new DecisionExecutor({
      starter,
      registry,
      brain,
      guard: new DefaultConstitutionGuard({ blockSeverities: ['highest'] }),
    })

    const action: Action = {
      ...costCutAction,
      classifications: ['life-safety'],
    }
    const result = await exec.execute(action)

    expect(result.status).toBe('blocked')
    expect(result.reasons?.[0]).toContain('life-safety')
    expect(starter.calls).toHaveLength(0)
  })

  it('gates on a human when a highest-severity constraint applies', async () => {
    const lifeSafety: Classification = {
      name: 'life-safety',
      kind: 'classification',
      description: 'Harm if mishandled.',
      severity: 'highest',
    }
    const brain = new InMemoryBrainClient({ classifications: [lifeSafety] })
    const exec = new DecisionExecutor({
      starter,
      registry,
      brain,
      guard: new DefaultConstitutionGuard(), // default: highest → requiresHuman
      requireHumanGate: true,
    })

    const action: Action = {
      ...costCutAction,
      classifications: ['life-safety'],
    }
    const result = await exec.execute(action)

    expect(result.status).toBe('awaiting_human')
    expect(result.requiresHuman).toBe(true)
    expect(starter.calls).toHaveLength(0)
  })

  it('executes (flagging requiresHuman) when the human gate is delegated to the workflow', async () => {
    const lifeSafety: Classification = {
      name: 'life-safety',
      kind: 'classification',
      description: 'Harm if mishandled.',
      severity: 'highest',
    }
    const brain = new InMemoryBrainClient({ classifications: [lifeSafety] })
    const exec = new DecisionExecutor({
      starter,
      registry,
      brain,
      guard: new DefaultConstitutionGuard(),
      requireHumanGate: false,
    })

    const action: Action = {
      ...costCutAction,
      classifications: ['life-safety'],
    }
    const result = await exec.execute(action)

    expect(result.status).toBe('executing')
    expect(result.requiresHuman).toBe(true)
    expect(starter.calls).toHaveLength(1)
  })

  it('executePending pulls ready actions from the Brain and skips blocked ones', async () => {
    const brain = new InMemoryBrainClient({
      actions: [
        costCutAction,
        { ...costCutAction, name: 'blocked-one', blockedBy: ['something'] },
        { ...costCutAction, name: 'done-one', status: 'done' },
      ],
    })
    const exec = new DecisionExecutor({
      starter,
      registry,
      guard: new DefaultConstitutionGuard(),
    })

    const results = await exec.executePending(brain)

    // only the single proposed, non-blocked action runs
    expect(results).toHaveLength(1)
    expect(results[0]?.item).toBe('aws-cost-cut-aurora')
    expect(starter.calls).toHaveLength(1)
  })
})

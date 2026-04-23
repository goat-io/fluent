// npx vitest run src/__tests__/engine/enforcement.spec.ts
//
// Tests for Issue #5: Runtime ExternalAction enforcement
//

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { ExternalActionEnforcer } from '../../engine/ExternalActionEnforcer.js'
import type {
  StepPayload,
  StepResult,
} from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('ExternalActionEnforcer', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    // Insert parent workflow run
    await db
      .insertInto('workflow_runs')
      .values({
        id: 'wf-enforce',
        tenantId: 'test',
        workflowName: 'enforce_test',
        workflowVersion: '1.0.0',
        status: 'RUNNING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()
  })

  const makePayload = (overrides: Partial<StepPayload> = {}): StepPayload => ({
    workflowRunId: 'wf-enforce',
    stepName: 'test_step',
    tenantId: 'test',
    input: {},
    attempt: 1,
    executorType: 'sandbox',
    executorConfig: {},
    ...overrides,
  })

  const result: StepResult = { output: { done: true } }

  it('passes when external actions exist for enforced executor type', async () => {
    // Insert an ExternalAction record
    await db
      .insertInto('external_actions')
      .values({
        id: 'ea-ok',
        workflowRunId: 'wf-enforce',
        stepName: 'test_step',
        attempt: 1,
        tenantId: 'test',
        provider: 'github',
        actionType: 'create_pr',
        idempotencyKey: 'wf-enforce:test_step:create_pr',
        status: 'completed',
        createdAt: new Date(),
      })
      .execute()

    const enforcer = new ExternalActionEnforcer({ db })
    const out = await enforcer.afterExecute!(makePayload(), result)
    expect(out).toBe(result)
  })

  it('warns when no external actions for enforced type (non-strict)', async () => {
    const warnings: string[] = []
    const enforcer = new ExternalActionEnforcer({
      db,
      strict: false,
      logger: { warn: (msg: any) => warnings.push(msg), error: () => {} },
    })

    const out = await enforcer.afterExecute!(makePayload(), result)
    expect(out).toBe(result) // Still passes through
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('test_step')
    expect(warnings[0]).toContain('ExternalAction')
  })

  it('throws when no external actions for enforced type (strict mode)', async () => {
    const enforcer = new ExternalActionEnforcer({ db, strict: true })

    await expect(enforcer.afterExecute!(makePayload(), result)).rejects.toThrow(
      'ExternalActionEnforcer',
    )
  })

  it('skips enforcement for function executor type (not enforced by default)', async () => {
    const warnings: string[] = []
    const enforcer = new ExternalActionEnforcer({
      db,
      strict: true,
      logger: { warn: (msg: any) => warnings.push(msg), error: () => {} },
    })

    // Function steps should not be enforced
    const out = await enforcer.afterExecute!(
      makePayload({ executorType: 'function' }),
      result,
    )
    expect(out).toBe(result)
    expect(warnings).toHaveLength(0)
  })

  it('skips enforcement for exempt steps', async () => {
    const enforcer = new ExternalActionEnforcer({
      db,
      strict: true,
      exemptSteps: ['pure_compute'],
    })

    const out = await enforcer.afterExecute!(
      makePayload({ stepName: 'pure_compute', executorType: 'sandbox' }),
      result,
    )
    expect(out).toBe(result)
  })

  it('enforces custom executor types', async () => {
    const enforcer = new ExternalActionEnforcer({
      db,
      strict: true,
      enforcedExecutorTypes: ['function', 'custom'],
    })

    // Function is now enforced
    await expect(
      enforcer.afterExecute!(makePayload({ executorType: 'function' }), result),
    ).rejects.toThrow('ExternalActionEnforcer')

    // Sandbox is NOT enforced (not in custom list)
    const out = await enforcer.afterExecute!(
      makePayload({ executorType: 'sandbox' }),
      result,
    )
    expect(out).toBe(result)
  })

  it('checks correct attempt number', async () => {
    // Insert action for attempt 1
    await db
      .insertInto('external_actions')
      .values({
        id: 'ea-attempt',
        workflowRunId: 'wf-enforce',
        stepName: 'test_step',
        attempt: 1,
        tenantId: 'test',
        provider: 'github',
        actionType: 'create_pr',
        idempotencyKey: 'wf-enforce:test_step:create_pr:1',
        status: 'completed',
        createdAt: new Date(),
      })
      .execute()

    const enforcer = new ExternalActionEnforcer({ db, strict: true })

    // Attempt 1 should pass
    await enforcer.afterExecute!(makePayload({ attempt: 1 }), result)

    // Attempt 2 should fail (no action for attempt 2)
    await expect(
      enforcer.afterExecute!(makePayload({ attempt: 2 }), result),
    ).rejects.toThrow()
  })
})

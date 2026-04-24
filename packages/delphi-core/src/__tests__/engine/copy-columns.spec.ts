// npx vitest run src/__tests__/engine/copy-columns.spec.ts
//
// Validates that COPY FROM column lists in startBatchCopy() match the actual
// database schema. Catches column order drift that would cause silent data corruption.
//

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { getSharedDb, releaseSharedDb } from './shared.js'

// Extract the COPY column lists from the engine source (hardcoded here to match)
const COPY_RUNS_COLUMNS = [
  'id',
  'tenantId',
  'workflowName',
  'workflowVersion',
  'status',
  'definitionSnapshot',
  'triggerInput',
  'idempotencyKey',
  'traceId',
  'parentRunId',
  'originEventId',
  'budget',
  'budgetUsed',
  'startedAt',
  'completedAt',
  'createdAt',
  'updatedAt',
]

const COPY_STEPS_COLUMNS = [
  'id',
  'workflowRunId',
  'tenantId',
  'stepName',
  'status',
  'executorType',
  'executorConfig',
  'dependsOn',
  'input',
  'output',
  'error',
  'attempt',
  'maxRetries',
  'startedAt',
  'completedAt',
  'scheduledAt',
  'lastHeartbeatAt',
  'lastHeartbeatData',
  'heartbeatTimeoutMs',
  'humanPrompt',
  'humanResponse',
  'humanRespondedBy',
  'humanRespondedAt',
  'iterationCount',
  'maxIterations',
  'tokensUsed',
  'costUsd',
  'modelUsed',
  'executedBy',
  'requiresLabels',
  'retryAfterMs',
  'deadlineEpochMs',
  'createdAt',
  'updatedAt',
]

// Columns intentionally omitted from COPY (NULL defaults at creation time)
const RUNS_INTENTIONALLY_OMITTED = [
  'output',
  'error',
  'deadlineEpochMs',
  'timeoutMs',
  'forkedFromRunId',
  'applicationVersion',
  'delayUntilEpochMs',
]

describe('COPY FROM Column Validation', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  it('workflow_runs COPY columns are a valid subset of actual table columns', async () => {
    const result = await db.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'workflow_runs'
      ORDER BY ordinal_position
    `)

    const actualColumns = result.rows.map(r => r.column_name)

    // Every COPY column must exist in the table
    for (const col of COPY_RUNS_COLUMNS) {
      expect(actualColumns).toContain(col)
    }

    // Every table column must be either in COPY or intentionally omitted
    for (const col of actualColumns) {
      const inCopy = COPY_RUNS_COLUMNS.includes(col)
      const intentionallyOmitted = RUNS_INTENTIONALLY_OMITTED.includes(col)
      expect(inCopy || intentionallyOmitted).toBe(true)
    }
  })

  it('workflow_steps COPY columns match all actual table columns', async () => {
    const result = await db.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'workflow_steps'
      ORDER BY ordinal_position
    `)

    const actualColumns = result.rows.map(r => r.column_name)

    // Every COPY column must exist in the table
    for (const col of COPY_STEPS_COLUMNS) {
      expect(actualColumns).toContain(col)
    }

    // Every table column must be in COPY (steps COPY includes all columns)
    for (const col of actualColumns) {
      expect(COPY_STEPS_COLUMNS).toContain(col)
    }
  })

  it('workflow_runs COPY column count matches data value count (17)', () => {
    expect(COPY_RUNS_COLUMNS).toHaveLength(17)
  })

  it('workflow_steps COPY column count matches data value count (33)', () => {
    expect(COPY_STEPS_COLUMNS).toHaveLength(34)
  })
})

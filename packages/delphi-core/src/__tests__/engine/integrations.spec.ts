// npx vitest run src/__tests__/engine/integrations.spec.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from '../../db/TestQueryBuilder.js'
import { ExternalActionExecutor } from '../../engine/ExternalActionExecutor.js'
import type { GitHubClient } from '../../integrations/github/GitHubIntegration.js'
import { createGitHubIntegration } from '../../integrations/github/GitHubIntegration.js'
import { IntegrationRegistry } from '../../integrations/IntegrationRegistry.js'
import type { LinearClient } from '../../integrations/linear/LinearIntegration.js'
import { createLinearIntegration } from '../../integrations/linear/LinearIntegration.js'
import type { SlackClient } from '../../integrations/slack/SlackIntegration.js'
import { createSlackIntegration } from '../../integrations/slack/SlackIntegration.js'
import type { StepExecutionContext } from '../../workflow/WorkflowBuilder.types.js'
import { getSharedDb, releaseSharedDb, truncateAll } from './shared.js'

describe('Integrations', () => {
  let db: TestDb
  let executor: ExternalActionExecutor

  beforeAll(async () => {
    db = await getSharedDb()
  })

  afterAll(async () => {
    await releaseSharedDb()
  })

  beforeEach(async () => {
    await truncateAll(db)
    // Insert a parent workflow run so FK constraints are satisfied
    await db
      .insertInto('workflow_runs')
      .values({
        id: 'wf-int-1',
        tenantId: 'test',
        workflowName: 'test_wf',
        workflowVersion: '1.0.0',
        status: 'RUNNING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute()
    executor = new ExternalActionExecutor({ db })
  })

  // ── IntegrationRegistry ──────────────────────────────────────

  describe('IntegrationRegistry', () => {
    it('get() returns registered integration', () => {
      const registry = new IntegrationRegistry()
      const github = createGitHubIntegration(mockGitHubClient())
      registry.register(github)

      const result = registry.get('github')
      expect(result.provider).toBe('github')
      expect(result.actions).toHaveProperty('create_pr')
    })

    it('get() throws for unknown provider', () => {
      const registry = new IntegrationRegistry()
      expect(() => registry.get('unknown')).toThrow(
        'Integration not found: "unknown"',
      )
    })

    it('list() returns provider names', () => {
      const registry = new IntegrationRegistry()
      registry.register(createGitHubIntegration(mockGitHubClient()))
      registry.register(createSlackIntegration(mockSlackClient()))

      const names = registry.list()
      expect(names).toContain('github')
      expect(names).toContain('slack')
      expect(names).toHaveLength(2)
    })
  })

  // ── GitHub Integration ───────────────────────────────────────

  describe('GitHubIntegration', () => {
    it('create_pr delegates to ExternalActionExecutor', async () => {
      const client = mockGitHubClient()
      const github = createGitHubIntegration(client)

      const result = await github.actions.create_pr.execute(
        { title: 'My PR', body: 'Description', branch: 'feat/x' },
        {
          externalActions: executor,
          workflowRunId: 'wf-int-1',
          stepName: 'open_pr',
          attempt: 1,
          tenantId: 'test',
        },
      )

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('42')
      expect(result.data).toEqual({
        id: 'pr-1',
        number: 42,
        url: 'https://github.com/test/repo/pull/42',
      })

      // Verify DB row
      const actions = await db
        .selectFrom('external_actions')
        .selectAll()
        .where('workflowRunId', '=', 'wf-int-1')
        .execute()

      expect(actions).toHaveLength(1)
      expect(actions[0].provider).toBe('github')
      expect(actions[0].actionType).toBe('create_pr')
      expect(actions[0].status).toBe('completed')
    })
  })

  // ── Idempotency ──────────────────────────────────────────────

  describe('idempotency', () => {
    it('integration action respects idempotency', async () => {
      let callCount = 0
      const client: GitHubClient = {
        createPR: async () => {
          callCount++
          return {
            id: 'pr-1',
            number: 42,
            url: 'https://github.com/test/repo/pull/42',
          }
        },
        createIssue: async () => ({ id: 'i-1', number: 1, url: '' }),
        addComment: async () => ({ id: 'c-1' }),
        mergePR: async () => ({ merged: true, sha: 'abc' }),
      }
      const github = createGitHubIntegration(client)

      const ctx = {
        externalActions: executor,
        workflowRunId: 'wf-int-1',
        stepName: 'open_pr',
        attempt: 1,
        tenantId: 'test',
      }

      await github.actions.create_pr.execute(
        { title: 'PR', body: 'body', branch: 'feat/x' },
        ctx,
      )

      const second = await github.actions.create_pr.execute(
        { title: 'PR', body: 'body', branch: 'feat/x' },
        ctx,
      )

      expect(callCount).toBe(1)
      expect(second.cached).toBe(true)
    })
  })

  // ── Linear Integration ───────────────────────────────────────

  describe('LinearIntegration', () => {
    it('create_issue works through ExternalAction', async () => {
      const client = mockLinearClient()
      const linear = createLinearIntegration(client)

      const result = await linear.actions.create_issue.execute(
        { title: 'Bug fix', body: 'Fix the thing', teamId: 'team-1' },
        {
          externalActions: executor,
          workflowRunId: 'wf-int-1',
          stepName: 'create_task',
          attempt: 1,
          tenantId: 'test',
        },
      )

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('LIN-123')
      expect(result.data).toEqual({
        id: 'issue-1',
        identifier: 'LIN-123',
        url: 'https://linear.app/team/LIN-123',
      })

      const actions = await db
        .selectFrom('external_actions')
        .selectAll()
        .where('provider', '=', 'linear')
        .execute()
      expect(actions).toHaveLength(1)
      expect(actions[0].actionType).toBe('create_issue')
    })
  })

  // ── Slack Integration ────────────────────────────────────────

  describe('SlackIntegration', () => {
    it('send_message works through ExternalAction', async () => {
      const client = mockSlackClient()
      const slack = createSlackIntegration(client)

      const result = await slack.actions.send_message.execute(
        { channel: '#general', text: 'Hello world' },
        {
          externalActions: executor,
          workflowRunId: 'wf-int-1',
          stepName: 'notify',
          attempt: 1,
          tenantId: 'test',
        },
      )

      expect(result.cached).toBe(false)
      expect(result.externalId).toBe('1234567890.123456')
      expect(result.data).toEqual({
        ts: '1234567890.123456',
        channel: '#general',
      })

      const actions = await db
        .selectFrom('external_actions')
        .selectAll()
        .where('provider', '=', 'slack')
        .execute()
      expect(actions).toHaveLength(1)
      expect(actions[0].actionType).toBe('send_message')
    })
  })

  // ── StepExecutionContext ─────────────────────────────────────

  describe('StepExecutionContext', () => {
    it('integration accessible via StepExecutionContext', () => {
      const registry = new IntegrationRegistry()
      registry.register(createGitHubIntegration(mockGitHubClient()))

      const context: StepExecutionContext = {
        externalActions: executor,
        integrations: registry,
      }

      expect(context.integrations).toBeDefined()
      expect(context.integrations!.has('github')).toBe(true)
      expect(context.externalActions).toBe(executor)
    })
  })
})

// ── Mock Factories ─────────────────────────────────────────────

function mockGitHubClient(): GitHubClient {
  return {
    createPR: async () => ({
      id: 'pr-1',
      number: 42,
      url: 'https://github.com/test/repo/pull/42',
    }),
    createIssue: async () => ({
      id: 'issue-1',
      number: 10,
      url: 'https://github.com/test/repo/issues/10',
    }),
    addComment: async () => ({ id: 'comment-1' }),
    mergePR: async () => ({ merged: true, sha: 'abc123' }),
  }
}

function mockLinearClient(): LinearClient {
  return {
    createIssue: async () => ({
      id: 'issue-1',
      identifier: 'LIN-123',
      url: 'https://linear.app/team/LIN-123',
    }),
    updateIssue: async () => ({
      id: 'issue-1',
      identifier: 'LIN-123',
      url: 'https://linear.app/team/LIN-123',
    }),
    addComment: async () => ({ id: 'comment-1' }),
  }
}

function mockSlackClient(): SlackClient {
  return {
    sendMessage: async () => ({ ts: '1234567890.123456', channel: '#general' }),
    updateMessage: async () => ({
      ts: '1234567890.123456',
      channel: '#general',
    }),
  }
}

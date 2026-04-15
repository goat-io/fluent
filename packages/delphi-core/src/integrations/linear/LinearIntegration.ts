// npx vitest run src/__tests__/engine/integrations.spec.ts

import { createIntegrationAction } from '../createIntegrationAction.js'
import type { Integration } from '../Integration.js'

export interface LinearClient {
  createIssue(req: {
    title: string
    body: string
    teamId: string
    labels?: string[]
  }): Promise<{ id: string; identifier: string; url: string }>
  updateIssue(req: {
    issueId: string
    title?: string
    body?: string
    status?: string
  }): Promise<{ id: string; identifier: string; url: string }>
  addComment(req: { issueId: string; body: string }): Promise<{ id: string }>
}

export function createLinearIntegration(client: LinearClient): Integration {
  return {
    provider: 'linear',
    actions: {
      create_issue: createIntegrationAction<
        { title: string; body: string; teamId: string; labels?: string[] },
        { id: string; identifier: string; url: string }
      >('linear', 'create_issue', async req => {
        const issue = await client.createIssue(req)
        return { externalId: issue.identifier, data: issue }
      }),

      update_issue: createIntegrationAction<
        { issueId: string; title?: string; body?: string; status?: string },
        { id: string; identifier: string; url: string }
      >('linear', 'update_issue', async req => {
        const issue = await client.updateIssue(req)
        return { externalId: issue.identifier, data: issue }
      }),

      add_comment: createIntegrationAction<
        { issueId: string; body: string },
        { id: string }
      >('linear', 'add_comment', async req => {
        const comment = await client.addComment(req)
        return { externalId: comment.id, data: comment }
      }),
    },
  }
}

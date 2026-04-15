// npx vitest run src/__tests__/engine/integrations.spec.ts

import { createIntegrationAction } from '../createIntegrationAction.js'
import type { Integration } from '../Integration.js'

export interface GitHubClient {
  createPR(req: {
    title: string
    body: string
    branch: string
    baseBranch?: string
  }): Promise<{ id: string; number: number; url: string }>
  createIssue(req: {
    title: string
    body: string
    labels?: string[]
  }): Promise<{ id: string; number: number; url: string }>
  addComment(req: {
    issueNumber: number
    body: string
  }): Promise<{ id: string }>
  mergePR(req: {
    prNumber: number
    mergeMethod?: string
  }): Promise<{ merged: boolean; sha: string }>
}

export function createGitHubIntegration(client: GitHubClient): Integration {
  return {
    provider: 'github',
    actions: {
      create_pr: createIntegrationAction<
        { title: string; body: string; branch: string; baseBranch?: string },
        { id: string; number: number; url: string }
      >('github', 'create_pr', async req => {
        const pr = await client.createPR(req)
        return { externalId: String(pr.number), data: pr }
      }),

      create_issue: createIntegrationAction<
        { title: string; body: string; labels?: string[] },
        { id: string; number: number; url: string }
      >('github', 'create_issue', async req => {
        const issue = await client.createIssue(req)
        return { externalId: String(issue.number), data: issue }
      }),

      add_comment: createIntegrationAction<
        { issueNumber: number; body: string },
        { id: string }
      >('github', 'add_comment', async req => {
        const comment = await client.addComment(req)
        return { externalId: comment.id, data: comment }
      }),

      merge_pr: createIntegrationAction<
        { prNumber: number; mergeMethod?: string },
        { merged: boolean; sha: string }
      >('github', 'merge_pr', async req => {
        const result = await client.mergePR(req)
        return { externalId: String(req.prNumber), data: result }
      }),
    },
  }
}

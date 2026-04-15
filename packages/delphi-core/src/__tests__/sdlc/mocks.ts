// Mock external service adapters for SDLC workflow testing
// These track all calls for assertion and support idempotency testing

export interface LinearIssue {
  id: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'done'
  labels: string[]
  externalId?: string
}

export interface GitHubPR {
  id: string
  title: string
  body: string
  branch: string
  files: Array<{ path: string; content: string }>
  status: 'open' | 'merged' | 'closed'
  reviews: Array<{ approved: boolean; comment: string }>
}

export interface UIArtifact {
  id: string
  name: string
  type: 'component' | 'page' | 'layout'
  code: string
}

/**
 * Mock Linear adapter — tracks all created issues for assertion.
 * Supports idempotency via externalId deduplication.
 */
export class MockLinearAdapter {
  readonly issues: LinearIssue[] = []
  readonly callLog: Array<{ method: string; args: any; timestamp: number }> = []

  async createIssue(input: {
    title: string
    description: string
    labels?: string[]
    externalId?: string
  }): Promise<LinearIssue> {
    this.callLog.push({
      method: 'createIssue',
      args: input,
      timestamp: Date.now(),
    })

    // Idempotency: if externalId already exists, return existing
    if (input.externalId) {
      const existing = this.issues.find(i => i.externalId === input.externalId)
      if (existing) {
        return existing
      }
    }

    const issue: LinearIssue = {
      id: `LIN-${this.issues.length + 1}`,
      title: input.title,
      description: input.description,
      status: 'todo',
      labels: input.labels ?? [],
      externalId: input.externalId,
    }
    this.issues.push(issue)
    return issue
  }

  async updateIssue(
    id: string,
    updates: Partial<LinearIssue>,
  ): Promise<LinearIssue> {
    this.callLog.push({
      method: 'updateIssue',
      args: { id, updates },
      timestamp: Date.now(),
    })
    const issue = this.issues.find(i => i.id === id)
    if (!issue) {
      throw new Error(`Issue ${id} not found`)
    }
    Object.assign(issue, updates)
    return issue
  }

  reset(): void {
    this.issues.length = 0
    this.callLog.length = 0
  }
}

/**
 * Mock GitHub adapter — tracks PRs and commits.
 * Supports idempotency via branch name deduplication.
 */
export class MockGitHubAdapter {
  readonly prs: GitHubPR[] = []
  readonly commits: Array<{
    branch: string
    message: string
    files: string[]
  }> = []
  readonly callLog: Array<{ method: string; args: any; timestamp: number }> = []

  async createPR(input: {
    title: string
    body: string
    branch: string
    files: Array<{ path: string; content: string }>
  }): Promise<GitHubPR> {
    this.callLog.push({
      method: 'createPR',
      args: input,
      timestamp: Date.now(),
    })

    // Idempotency: if branch already has open PR, return existing
    const existing = this.prs.find(
      p => p.branch === input.branch && p.status === 'open',
    )
    if (existing) {
      return existing
    }

    const pr: GitHubPR = {
      id: `PR-${this.prs.length + 1}`,
      title: input.title,
      body: input.body,
      branch: input.branch,
      files: input.files,
      status: 'open',
      reviews: [],
    }
    this.prs.push(pr)
    return pr
  }

  async addReview(
    prId: string,
    review: { approved: boolean; comment: string },
  ): Promise<void> {
    this.callLog.push({
      method: 'addReview',
      args: { prId, review },
      timestamp: Date.now(),
    })
    const pr = this.prs.find(p => p.id === prId)
    if (!pr) {
      throw new Error(`PR ${prId} not found`)
    }
    pr.reviews.push(review)
  }

  async mergePR(prId: string): Promise<void> {
    this.callLog.push({
      method: 'mergePR',
      args: { prId },
      timestamp: Date.now(),
    })
    const pr = this.prs.find(p => p.id === prId)
    if (!pr) {
      throw new Error(`PR ${prId} not found`)
    }
    pr.status = 'merged'
  }

  async commit(
    branch: string,
    message: string,
    files: string[],
  ): Promise<void> {
    this.callLog.push({
      method: 'commit',
      args: { branch, message, files },
      timestamp: Date.now(),
    })
    this.commits.push({ branch, message, files })
  }

  reset(): void {
    this.prs.length = 0
    this.commits.length = 0
    this.callLog.length = 0
  }
}

/**
 * Mock UI generator — tracks generated artifacts.
 */
export class MockUIGenerator {
  readonly artifacts: UIArtifact[] = []
  readonly callLog: Array<{ method: string; args: any; timestamp: number }> = []

  async generate(input: {
    name: string
    type: 'component' | 'page' | 'layout'
    spec: string
  }): Promise<UIArtifact> {
    this.callLog.push({
      method: 'generate',
      args: input,
      timestamp: Date.now(),
    })

    const artifact: UIArtifact = {
      id: `UI-${this.artifacts.length + 1}`,
      name: input.name,
      type: input.type,
      code: `// Generated ${input.type}: ${input.name}\nexport const ${input.name} = () => <div>${input.spec}</div>`,
    }
    this.artifacts.push(artifact)
    return artifact
  }

  reset(): void {
    this.artifacts.length = 0
    this.callLog.length = 0
  }
}

/**
 * Side effect tracker — records all external calls across all adapters.
 * Used to verify no duplicate side effects during idempotency testing.
 */
export class SideEffectTracker {
  readonly effects: Array<{
    service: string
    method: string
    args: any
    timestamp: number
    stepName: string
  }> = []

  record(service: string, method: string, args: any, stepName: string): void {
    this.effects.push({
      service,
      method,
      args,
      timestamp: Date.now(),
      stepName,
    })
  }

  getEffectsForStep(stepName: string) {
    return this.effects.filter(e => e.stepName === stepName)
  }

  getEffectsForService(service: string) {
    return this.effects.filter(e => e.service === service)
  }

  reset(): void {
    this.effects.length = 0
  }
}

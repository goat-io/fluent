// npx vitest run src/__tests__/integration/git-workflow.spec.ts
import type { ContainerHandle } from '../container/ContainerHandle.js'
import type { SandboxGitExtraction } from '../types/SandboxConfig.js'

export interface GitSetupConfig {
  cloneUrl: string
  branch?: string
  credentials?: { token: string }
  workdir: string
}

export interface GitExtractResult {
  branch: string
  commitSha: string
  pushed: boolean
  diffStat: string
}

export class GitWorkflowManager {
  private container: ContainerHandle

  constructor(container: ContainerHandle) {
    this.container = container
  }

  /**
   * Setup git inside the container: configure credentials, clone repo, checkout branch.
   */
  async setup(config: GitSetupConfig): Promise<void> {
    // Configure git user
    await this.container.exec(
      'git config --global user.email "agent@goatlab.io"',
    )
    await this.container.exec('git config --global user.name "Goat Agent"')

    // Configure credentials if provided
    if (config.credentials?.token) {
      await this.container.exec(
        `git config --global credential.helper '!f() { echo "password=${config.credentials!.token}"; }; f'`,
      )
    }

    // Clone the repo
    const cloneResult = await this.container.exec(
      `git clone ${config.cloneUrl} ${config.workdir}`,
      { cwd: '/', timeout: 120_000 },
    )
    if (cloneResult.exitCode !== 0) {
      throw new Error(`Git clone failed: ${cloneResult.stderr}`)
    }

    // Checkout or create branch
    if (config.branch) {
      const checkoutResult = await this.container.exec(
        `git checkout ${config.branch} 2>/dev/null || git checkout -b ${config.branch}`,
        { cwd: config.workdir },
      )
      if (checkoutResult.exitCode !== 0) {
        throw new Error(`Git checkout failed: ${checkoutResult.stderr}`)
      }
    }
  }

  /**
   * Extract git results from the container.
   */
  async extract(config?: SandboxGitExtraction): Promise<GitExtractResult> {
    // Get current branch
    const branchResult = await this.container.exec(
      'git rev-parse --abbrev-ref HEAD',
    )
    const branch = branchResult.stdout.trim()

    // Get latest commit SHA
    const shaResult = await this.container.exec('git rev-parse HEAD')
    const commitSha = shaResult.stdout.trim()

    // Get diff stat
    const diffResult = await this.container.exec(
      'git diff --stat HEAD~1 2>/dev/null || echo "No previous commit"',
    )
    const diffStat = diffResult.stdout.trim()

    // Push if requested
    let pushed = false
    if (config?.push) {
      const remote = config.remote ?? 'origin'
      const pushBranch = config.branch ?? branch
      const pushResult = await this.container.exec(
        `git push ${remote} ${pushBranch}`,
        { timeout: 60_000 },
      )
      pushed = pushResult.exitCode === 0
    }

    return { branch, commitSha, pushed, diffStat }
  }
}

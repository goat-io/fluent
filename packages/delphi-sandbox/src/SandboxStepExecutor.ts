// npx vitest run src/__tests__/integration/sandbox-executor.spec.ts

import type { LLMAdapter } from '@goatlab/delphi-ai'
import type {
  StepExecutor,
  StepPayload,
  StepResult,
} from '@goatlab/delphi-core'
import { NonRetryableError } from '@goatlab/delphi-core'
import { SandboxAgentRunner } from './agent/SandboxAgentRunner.js'
import type { ContainerHandle } from './container/ContainerHandle.js'
import { ContainerManager } from './container/ContainerManager.js'
import { GitWorkflowManager } from './git/GitWorkflowManager.js'
import { SandboxToolRegistry } from './tools/SandboxToolRegistry.js'
import type {
  SandboxArtifacts,
  SandboxExecutorConfig,
  SandboxStepExecutorConfig,
} from './types/SandboxConfig.js'
import {
  DEFAULT_IMAGE,
  DEFAULT_TIMEOUT,
  DEFAULT_WORKDIR,
} from './types/SandboxConfig.js'
import { resolveTemplate, resolveTemplates } from './utils/TemplateResolver.js'

export class SandboxStepExecutor implements StepExecutor {
  readonly type = 'sandbox'
  private containerManager: ContainerManager
  private toolRegistry: SandboxToolRegistry
  private agentRunner?: SandboxAgentRunner
  private config: SandboxStepExecutorConfig
  private llmAdapter?: LLMAdapter

  constructor(config: SandboxStepExecutorConfig = {}, llmAdapter?: LLMAdapter) {
    this.config = config
    this.llmAdapter = llmAdapter
    this.containerManager = new ContainerManager({
      dockerSocketPath: config.dockerSocketPath,
      logger: config.logger,
    })
    this.toolRegistry = new SandboxToolRegistry()

    if (llmAdapter) {
      this.agentRunner = new SandboxAgentRunner(
        llmAdapter,
        this.toolRegistry,
        config.logger
          ? { info: config.logger.info, debug: config.logger.debug }
          : undefined,
      )
    }
  }

  async execute(payload: StepPayload): Promise<StepResult> {
    const sandboxConfig =
      payload.executorConfig as unknown as SandboxExecutorConfig
    const secrets = sandboxConfig.secrets ?? {}

    // Resolve image
    const image = sandboxConfig.image
      ? resolveTemplate(sandboxConfig.image, payload, secrets)
      : (this.config.defaultImage ?? DEFAULT_IMAGE)

    const resolvedConfig: SandboxExecutorConfig = {
      ...sandboxConfig,
      image,
      workdir: sandboxConfig.workdir ?? DEFAULT_WORKDIR,
    }

    // Create container
    const container = await this.containerManager.createContainer(
      resolvedConfig,
      {
        workflowRunId: payload.workflowRunId,
        stepName: payload.stepName,
        tenantId: payload.tenantId,
      },
    )

    const timeout = sandboxConfig.resources?.timeout ?? DEFAULT_TIMEOUT
    const timeoutHandle = setTimeout(() => {
      container.destroy().catch(() => {})
    }, timeout)

    try {
      // ── Setup phase ──────────────────────────────────────────
      if (sandboxConfig.setup?.length) {
        const resolvedSetup = resolveTemplates(
          sandboxConfig.setup,
          payload,
          secrets,
        )
        for (const cmd of resolvedSetup) {
          this.config.logger?.debug?.(
            `[Sandbox] Setup: ${cmd.substring(0, 100)}`,
          )
          const result = await container.exec(cmd, {
            timeout: 120_000,
            cwd: resolvedConfig.workdir,
          })
          if (result.exitCode !== 0) {
            throw new NonRetryableError(
              `Setup command failed (exit ${result.exitCode}): ${cmd.substring(0, 80)}`,
              { stderr: result.stderr, command: cmd },
            )
          }
        }
      }

      // ── Execute phase ────────────────────────────────────────
      let executionOutput: Record<string, unknown>

      if (sandboxConfig.execute.type === 'script') {
        executionOutput = await this.executeScript(
          container,
          sandboxConfig,
          payload,
        )
      } else if (sandboxConfig.execute.type === 'agent') {
        if (!this.agentRunner) {
          throw new NonRetryableError(
            'Agent execution requires an LLMAdapter. Pass it to SandboxStepExecutor constructor.',
          )
        }
        const resolvedPrompt = resolveTemplate(
          sandboxConfig.execute.systemPrompt,
          payload,
          secrets,
        )
        const agentResult = await this.agentRunner.run(
          container,
          { ...sandboxConfig.execute, systemPrompt: resolvedPrompt },
          payload.input as Record<string, unknown>,
        )
        executionOutput = {
          ...agentResult.output,
          _agent: {
            turns: agentResult.turns,
            toolCalls: agentResult.toolCalls,
            tokenUsage: agentResult.tokenUsage,
          },
        }
      } else {
        throw new NonRetryableError(
          `Unknown execution type: ${(sandboxConfig.execute as any)?.type}`,
        )
      }

      // ── Extract phase ────────────────────────────────────────
      const artifacts = await this.extractArtifacts(
        container,
        sandboxConfig,
        payload,
      )

      return {
        output: {
          ...executionOutput,
          ...(artifacts ? { _artifacts: artifacts } : {}),
        } as any,
      }
    } finally {
      clearTimeout(timeoutHandle)
      await container.destroy()
    }
  }

  private async executeScript(
    container: ContainerHandle,
    config: SandboxExecutorConfig,
    payload: StepPayload,
  ): Promise<Record<string, unknown>> {
    const scriptConfig = config.execute as {
      type: 'script'
      commands: string[]
      env?: Record<string, string>
    }
    const secrets = config.secrets ?? {}
    const results: Array<{
      command: string
      exitCode: number
      stdout: string
      stderr: string
    }> = []
    let lastStdout = ''

    for (const cmd of scriptConfig.commands) {
      const resolved = resolveTemplate(cmd, payload, secrets)
      const result = await container.exec(resolved, {
        cwd: config.workdir ?? DEFAULT_WORKDIR,
        env: scriptConfig.env,
        timeout: 120_000,
      })
      results.push({
        command: resolved.substring(0, 100),
        exitCode: result.exitCode,
        stdout: result.stdout.substring(0, 10_000),
        stderr: result.stderr.substring(0, 5_000),
      })
      lastStdout = result.stdout

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Command failed (exit ${result.exitCode}): ${resolved.substring(0, 80)}`,
          stderr: result.stderr.substring(0, 5_000),
          results,
        }
      }
    }

    return {
      success: true,
      stdout: lastStdout.substring(0, 10_000),
      results,
    }
  }

  private async extractArtifacts(
    container: ContainerHandle,
    config: SandboxExecutorConfig,
    payload: StepPayload,
  ): Promise<SandboxArtifacts | null> {
    if (!config.extract) {
      return null
    }

    const artifacts: SandboxArtifacts = { exitCode: 0 }

    // Extract git state
    if (config.extract.git) {
      const gitManager = new GitWorkflowManager(container)
      const resolvedGit = config.extract.git.branch
        ? {
            ...config.extract.git,
            branch: resolveTemplate(
              config.extract.git.branch,
              payload,
              config.secrets,
            ),
          }
        : config.extract.git
      artifacts.git = await gitManager.extract(resolvedGit)
    }

    // Extract files
    if (config.extract.files?.length) {
      artifacts.files = {}
      for (const filePath of config.extract.files) {
        const resolved = resolveTemplate(filePath, payload, config.secrets)
        try {
          const buf = await container.copyFileOut(resolved)
          artifacts.files[resolved] = buf.toString('base64')
        } catch {
          // File not found — skip
        }
      }
    }

    // Extract env vars
    if (config.extract.env?.length) {
      artifacts.env = {}
      for (const varName of config.extract.env) {
        const value = await container.getEnv(varName)
        if (value !== undefined) {
          artifacts.env[varName] = value
        }
      }
    }

    // Capture stdout
    if (config.extract.stdout) {
      const result = await container.exec(
        'cat /tmp/sandbox-stdout.log 2>/dev/null || echo ""',
        { cwd: '/' },
      )
      artifacts.stdout = result.stdout
    }

    return artifacts
  }

  /** Get the container manager for advanced use */
  getContainerManager(): ContainerManager {
    return this.containerManager
  }

  /** Clean up stale containers */
  async cleanupStaleContainers(olderThanMs = 3600_000): Promise<number> {
    return this.containerManager.cleanupStaleContainers(olderThanMs)
  }
}

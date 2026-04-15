// @goatlab/delphi-sandbox — Sandboxed Docker execution for the agent workflow engine
// npx vitest run

export type { AgentRunResult } from './agent/SandboxAgentRunner.js'
// ── Agent Runner ───────────────────────────────────────────────────
export { SandboxAgentRunner } from './agent/SandboxAgentRunner.js'
// ── Container Layer ────────────────────────────────────────────────
export { ContainerHandle } from './container/ContainerHandle.js'
export type { ContainerManagerConfig } from './container/ContainerManager.js'
export { ContainerManager } from './container/ContainerManager.js'
export type {
  GitExtractResult,
  GitSetupConfig,
} from './git/GitWorkflowManager.js'
// ── Git Workflow ───────────────────────────────────────────────────
export { GitWorkflowManager } from './git/GitWorkflowManager.js'
// ── Main Executor ──────────────────────────────────────────────────
export { SandboxStepExecutor } from './SandboxStepExecutor.js'
export { BashTool } from './tools/BashTool.js'
export { FileReadTool } from './tools/FileReadTool.js'
export { FileWriteTool } from './tools/FileWriteTool.js'
export { GitTool } from './tools/GitTool.js'
// ── Tools ──────────────────────────────────────────────────────────
export type { SandboxTool, ToolResult } from './tools/SandboxTool.js'
export { SandboxToolRegistry } from './tools/SandboxToolRegistry.js'
// ── Types ──────────────────────────────────────────────────────────
export type {
  ExecOptions,
  ExecResult,
  SandboxAgentExecution,
  SandboxArtifacts,
  SandboxExecutorConfig,
  SandboxExtraction,
  SandboxGitExtraction,
  SandboxResources,
  SandboxScriptExecution,
  SandboxStepExecutorConfig,
  SandboxToolName,
  SandboxVolumeMount,
} from './types/SandboxConfig.js'
export {
  DEFAULT_IMAGE,
  DEFAULT_MAX_TURNS,
  DEFAULT_MEMORY,
  DEFAULT_PIDS_LIMIT,
  DEFAULT_SHELL,
  DEFAULT_TIMEOUT,
  DEFAULT_WORKDIR,
} from './types/SandboxConfig.js'

// ── Utilities ──────────────────────────────────────────────────────
export { resolveTemplate, resolveTemplates } from './utils/TemplateResolver.js'

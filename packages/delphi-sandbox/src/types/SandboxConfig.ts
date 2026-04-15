// npx vitest run src/__tests__/unit/template-resolver.spec.ts

// ── Execution Modes ────────────────────────────────────────────────

export interface SandboxScriptExecution {
  type: 'script'
  commands: string[]
  shell?: string
  env?: Record<string, string>
}

export type SandboxToolName =
  | 'bash'
  | 'file_read'
  | 'file_write'
  | 'git'
  | 'http'

export interface SandboxAgentExecution {
  type: 'agent'
  model: string
  systemPrompt: string
  tools: SandboxToolName[]
  maxTurns?: number
  maxTokens?: number
  temperature?: number
  env?: Record<string, string>
}

// ── Extraction ─────────────────────────────────────────────────────

export interface SandboxGitExtraction {
  branch?: string
  push?: boolean
  remote?: string
}

export interface SandboxExtraction {
  git?: SandboxGitExtraction
  files?: string[]
  env?: string[]
  stdout?: boolean
}

// ── Resources ──────────────────────────────────────────────────────

export interface SandboxResources {
  memory?: string
  cpus?: number
  timeout?: number
  pidsLimit?: number
}

// ── Volume Mounts ──────────────────────────────────────────────────

export interface SandboxVolumeMount {
  hostPath: string
  containerPath: string
  readOnly?: boolean
}

// ── Main Config ────────────────────────────────────────────────────

export interface SandboxExecutorConfig {
  image?: string
  dockerfile?: string
  setup?: string[]
  execute: SandboxScriptExecution | SandboxAgentExecution
  extract?: SandboxExtraction
  resources?: SandboxResources
  secrets?: Record<string, string>
  /**
   * Container network mode. Defaults to 'none' (complete isolation).
   * Use 'bridge' for containers that need network access, or
   * 'host' for containers that need full host network access.
   */
  networkMode?: 'bridge' | 'none' | 'host'
  /**
   * Allowed domains when networkMode is 'bridge'.
   * When set, iptables rules restrict outbound traffic to only these domains.
   * Has no effect when networkMode is 'none' (all traffic blocked) or 'host'.
   */
  allowedDomains?: string[]
  workdir?: string
  volumes?: SandboxVolumeMount[]
  /**
   * Enable Docker-in-Docker: mounts the host Docker socket into the container.
   * This lets the agent spin up sibling containers (databases, services, etc.)
   * via `docker run`, `docker compose`, etc.
   *
   * When enabled:
   * - Docker socket is mounted at /var/run/docker.sock
   * - CAP_NET_RAW capability is added (needed for container networking)
   * - The agent can run `docker`, `docker compose`, `docker build`
   *
   * Use `goatlab/agent-full` image which includes the Docker CLI pre-installed,
   * or add Docker CLI in your setup commands.
   */
  dockerAccess?: boolean
}

// ── Exec Results ───────────────────────────────────────────────────

export interface ExecOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

// ── Artifacts ──────────────────────────────────────────────────────

export interface SandboxArtifacts {
  files?: Record<string, string>
  git?: {
    branch: string
    commitSha: string
    pushed: boolean
    diffStat: string
  }
  env?: Record<string, string>
  stdout?: string
  exitCode: number
}

// ── Executor Config ────────────────────────────────────────────────

export interface SandboxStepExecutorConfig {
  dockerSocketPath?: string
  defaultImage?: string
  defaultResources?: SandboxResources
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export const DEFAULT_IMAGE = 'node:20-bookworm'
export const DEFAULT_WORKDIR = '/workspace'
export const DEFAULT_SHELL = '/bin/bash'
export const DEFAULT_TIMEOUT = 300_000
export const DEFAULT_MAX_TURNS = 20
export const DEFAULT_MEMORY = '2g'
export const DEFAULT_PIDS_LIMIT = 256

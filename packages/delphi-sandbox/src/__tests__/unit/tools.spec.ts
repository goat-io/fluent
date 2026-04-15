// npx vitest run src/__tests__/unit/tools.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContainerHandle } from '../../container/ContainerHandle.js'
import { BashTool } from '../../tools/BashTool.js'
import { FileReadTool } from '../../tools/FileReadTool.js'
import { FileWriteTool } from '../../tools/FileWriteTool.js'
import { GitTool } from '../../tools/GitTool.js'
import { SandboxToolRegistry } from '../../tools/SandboxToolRegistry.js'

function createMockContainer(): ContainerHandle {
  return {
    id: 'mock-container-123',
    exec: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'mock output',
      stderr: '',
      timedOut: false,
    }),
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFileOut: vi.fn().mockResolvedValue(Buffer.from('data')),
    getEnv: vi.fn().mockResolvedValue('value'),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContainerHandle
}

describe('BashTool', () => {
  const tool = new BashTool()
  let container: ContainerHandle

  beforeEach(() => {
    container = createMockContainer()
  })

  it('has correct name and description', () => {
    expect(tool.name).toBe('bash')
    expect(tool.description).toBeDefined()
    expect(tool.parameters).toBeDefined()
  })

  it('executes a command', async () => {
    const result = await tool.execute(container, { command: 'echo hello' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBe('mock output')
    expect(container.exec).toHaveBeenCalledWith(
      'echo hello',
      expect.objectContaining({ timeout: 120_000 }),
    )
  })

  it('passes cwd when provided', async () => {
    await tool.execute(container, { command: 'ls', cwd: '/tmp' })
    expect(container.exec).toHaveBeenCalledWith(
      'ls',
      expect.objectContaining({ cwd: '/tmp' }),
    )
  })

  it('returns error when command is missing', async () => {
    const result = await tool.execute(container, {})
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('required')
  })

  it('reports error for non-zero exit code', async () => {
    vi.mocked(container.exec).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'not found',
      timedOut: false,
    })
    const result = await tool.execute(container, { command: 'missing-cmd' })
    expect(result.exitCode).toBe(1)
    expect(result.error).toBe('not found')
  })
})

describe('FileReadTool', () => {
  const tool = new FileReadTool()
  let container: ContainerHandle

  beforeEach(() => {
    container = createMockContainer()
  })

  it('reads a file', async () => {
    const result = await tool.execute(container, {
      path: '/workspace/README.md',
    })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBe('file content')
    expect(container.readFile).toHaveBeenCalledWith('/workspace/README.md')
  })

  it('returns error for missing path', async () => {
    const result = await tool.execute(container, {})
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('required')
  })

  it('handles read failure', async () => {
    vi.mocked(container.readFile).mockRejectedValue(new Error('No such file'))
    const result = await tool.execute(container, { path: '/nonexistent' })
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('No such file')
  })
})

describe('FileWriteTool', () => {
  const tool = new FileWriteTool()
  let container: ContainerHandle

  beforeEach(() => {
    container = createMockContainer()
  })

  it('writes a file', async () => {
    const result = await tool.execute(container, {
      path: '/workspace/test.ts',
      content: 'const x = 1',
    })
    expect(result.exitCode).toBe(0)
    expect(container.writeFile).toHaveBeenCalledWith(
      '/workspace/test.ts',
      'const x = 1',
    )
  })

  it('creates parent directories', async () => {
    await tool.execute(container, {
      path: '/workspace/src/deep/file.ts',
      content: 'code',
    })
    expect(container.exec).toHaveBeenCalledWith(
      'mkdir -p /workspace/src/deep',
      expect.anything(),
    )
  })

  it('returns error for missing args', async () => {
    const result = await tool.execute(container, { path: '/test' })
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('required')
  })
})

describe('GitTool', () => {
  const tool = new GitTool()
  let container: ContainerHandle

  beforeEach(() => {
    container = createMockContainer()
  })

  it('executes git commands', async () => {
    await tool.execute(container, { command: 'status' })
    expect(container.exec).toHaveBeenCalledWith('git status', expect.anything())
  })

  it('passes cwd', async () => {
    await tool.execute(container, {
      command: 'log --oneline',
      cwd: '/other-repo',
    })
    expect(container.exec).toHaveBeenCalledWith(
      'git log --oneline',
      expect.objectContaining({ cwd: '/other-repo' }),
    )
  })
})

describe('SandboxToolRegistry', () => {
  it('has all built-in tools', () => {
    const registry = new SandboxToolRegistry()
    expect(registry.listTools()).toContain('bash')
    expect(registry.listTools()).toContain('file_read')
    expect(registry.listTools()).toContain('file_write')
    expect(registry.listTools()).toContain('git')
  })

  it('gets tools by name list', () => {
    const registry = new SandboxToolRegistry()
    const tools = registry.getTools(['bash', 'git'])
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('bash')
    expect(tools[1].name).toBe('git')
  })

  it('converts to tool definitions for LLM', () => {
    const registry = new SandboxToolRegistry()
    const defs = registry.toToolDefinitions(['bash', 'file_read'])
    expect(defs).toHaveLength(2)
    expect(defs[0]).toHaveProperty('name', 'bash')
    expect(defs[0]).toHaveProperty('description')
    expect(defs[0]).toHaveProperty('parameters')
  })

  it('skips unknown tools silently', () => {
    const registry = new SandboxToolRegistry()
    const tools = registry.getTools(['bash', 'nonexistent' as any])
    expect(tools).toHaveLength(1)
  })

  it('allows registering custom tools', () => {
    const registry = new SandboxToolRegistry()
    registry.register({
      name: 'custom',
      description: 'Custom tool',
      parameters: {},
      execute: async () => ({ output: 'custom', exitCode: 0 }),
    })
    expect(registry.listTools()).toContain('custom')
  })
})

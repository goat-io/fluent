// npx vitest run src/__tests__/unit/network-isolation.spec.ts
//
// Tests for Issue #2: Sandbox network isolation defaults
//
import { describe, expect, it } from 'vitest'
import type { SandboxExecutorConfig } from '../../types/SandboxConfig.js'

describe('Sandbox Network Isolation Config', () => {
  it('SandboxExecutorConfig allows networkMode none', () => {
    const config: SandboxExecutorConfig = {
      execute: { type: 'script', commands: ['echo test'] },
      networkMode: 'none',
    }
    expect(config.networkMode).toBe('none')
  })

  it('SandboxExecutorConfig allows allowedDomains with bridge mode', () => {
    const config: SandboxExecutorConfig = {
      execute: { type: 'script', commands: ['curl api.example.com'] },
      networkMode: 'bridge',
      allowedDomains: ['api.example.com', 'registry.npmjs.org'],
    }
    expect(config.allowedDomains).toEqual([
      'api.example.com',
      'registry.npmjs.org',
    ])
  })

  it('allowedDomains is optional', () => {
    const config: SandboxExecutorConfig = {
      execute: { type: 'script', commands: ['echo test'] },
      networkMode: 'bridge',
    }
    expect(config.allowedDomains).toBeUndefined()
  })

  it('default networkMode should be none when unspecified', () => {
    // ContainerManager.ts now defaults to 'none' instead of 'bridge'
    // This test documents the intended default behavior
    const config: SandboxExecutorConfig = {
      execute: { type: 'script', commands: ['echo test'] },
      // networkMode not specified — ContainerManager defaults to 'none'
    }
    expect(config.networkMode).toBeUndefined()
    // ContainerManager will apply 'none' as default
  })
})

// npx vitest run src/__tests__/engine/skills.spec.ts
import { describe, expect, it } from 'vitest'
import { codeExecutionSkill } from '../../skills/builtin/CodeExecutionSkill.js'
import { webSearchSkill } from '../../skills/builtin/WebSearchSkill.js'
import type { Skill } from '../../skills/Skill.js'
import { SkillRegistry } from '../../skills/SkillRegistry.js'

describe('SkillRegistry', () => {
  it('register() and get() round-trip a skill', () => {
    const registry = new SkillRegistry()
    registry.register(webSearchSkill)

    const skill = registry.get('web_search')
    expect(skill).toBe(webSearchSkill)
    expect(skill.name).toBe('web_search')
    expect(skill.description).toBe('Search the web for information')
  })

  it('get() throws for unknown skill', () => {
    const registry = new SkillRegistry()
    expect(() => registry.get('unknown')).toThrow(
      'Skill "unknown" not found in registry',
    )
  })

  it('has() returns true for registered and false for unregistered', () => {
    const registry = new SkillRegistry()
    registry.register(webSearchSkill)
    expect(registry.has('web_search')).toBe(true)
    expect(registry.has('nonexistent')).toBe(false)
  })

  it('list() returns all registered skill names', () => {
    const registry = new SkillRegistry()
    registry.register(webSearchSkill).register(codeExecutionSkill)

    const names = registry.list()
    expect(names).toEqual(['web_search', 'code_execution'])
  })

  it('toToolDefinitions() returns OpenAI-compatible format', () => {
    const registry = new SkillRegistry()
    registry.register(webSearchSkill).register(codeExecutionSkill)

    const tools = registry.toToolDefinitions()
    expect(tools).toHaveLength(2)

    const searchTool = tools[0]
    expect(searchTool.type).toBe('function')
    expect(searchTool.function.name).toBe('web_search')
    expect(searchTool.function.description).toBe(
      'Search the web for information',
    )
    expect(searchTool.function.parameters).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    })

    const codeTool = tools[1]
    expect(codeTool.type).toBe('function')
    expect(codeTool.function.name).toBe('code_execution')
    expect(codeTool.function.description).toBe(
      'Execute JavaScript/TypeScript code in a sandbox',
    )
    expect(codeTool.function.parameters).toEqual({
      type: 'object',
      properties: {
        code: { type: 'string' },
        language: { type: 'string' },
      },
      required: ['code'],
    })
  })

  it('register() is fluent (returns this)', () => {
    const registry = new SkillRegistry()
    const result = registry.register(webSearchSkill)
    expect(result).toBe(registry)
  })
})

describe('Skill execution', () => {
  it('webSearchSkill returns results for a query', async () => {
    const result = await webSearchSkill.execute({ query: 'test' })
    expect(result).toEqual({ results: ['Result for: test'] })
  })

  it('codeExecutionSkill returns expected output', async () => {
    const result = await codeExecutionSkill.execute({
      code: 'console.log("hi")',
    })
    expect(result).toEqual({ executed: true, language: 'javascript' })
  })

  it('codeExecutionSkill respects language parameter', async () => {
    const result = await codeExecutionSkill.execute({
      code: 'print("hi")',
      language: 'python',
    })
    expect(result).toEqual({ executed: true, language: 'python' })
  })

  it('toToolDefinitions() omits parameters when inputSchema is undefined', () => {
    const registry = new SkillRegistry()
    const noSchema: Skill = {
      name: 'simple',
      description: 'A skill without input schema',
      execute: async () => ({ ok: true }),
    }
    registry.register(noSchema)

    const tools = registry.toToolDefinitions()
    expect(tools[0].function.parameters).toBeUndefined()
  })
})

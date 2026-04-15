// npx vitest run src/__tests__/engine/skills.spec.ts
import type { Skill, ToolDefinition } from './Skill.js'

export class SkillRegistry {
  private skills = new Map<string, Skill>()

  /** Register a skill (fluent) */
  register(skill: Skill): this {
    this.skills.set(skill.name, skill)
    return this
  }

  /** Get a skill by name. Throws if not found. */
  get(name: string): Skill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new Error(`Skill "${name}" not found in registry`)
    }
    return skill
  }

  /** Check if a skill is registered */
  has(name: string): boolean {
    return this.skills.has(name)
  }

  /** List all registered skill names */
  list(): string[] {
    return [...this.skills.keys()]
  }

  /** Convert all skills to OpenAI-compatible tool definitions */
  toToolDefinitions(): ToolDefinition[] {
    return [...this.skills.values()].map(skill => ({
      type: 'function' as const,
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.inputSchema,
      },
    }))
  }
}

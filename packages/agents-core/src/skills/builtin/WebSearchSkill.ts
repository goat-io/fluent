// npx vitest run src/__tests__/engine/skills.spec.ts
import type { Skill } from '../Skill.js'

export const webSearchSkill: Skill = {
  name: 'web_search',
  description: 'Search the web for information',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  execute: async input => {
    return { results: [`Result for: ${(input as any).query}`] }
  },
}

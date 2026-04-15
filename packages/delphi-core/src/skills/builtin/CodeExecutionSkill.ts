// npx vitest run src/__tests__/engine/skills.spec.ts
import type { Skill } from '../Skill.js'

export const codeExecutionSkill: Skill = {
  name: 'code_execution',
  description: 'Execute JavaScript/TypeScript code in a sandbox',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: { type: 'string' },
    },
    required: ['code'],
  },
  execute: async input => {
    return { executed: true, language: (input as any).language ?? 'javascript' }
  },
}

// npx vitest run src/__tests__/unit/template-resolver.spec.ts

import type { StepPayload } from '@goatlab/delphi-core'
import { describe, expect, it } from 'vitest'
import {
  resolveTemplate,
  resolveTemplates,
} from '../../utils/TemplateResolver.js'

const mockPayload: StepPayload = {
  workflowRunId: 'wf-abc123',
  stepName: 'implement',
  tenantId: 'tenant-xyz',
  input: { task: 'add login page', repo: 'my-project' },
  attempt: 2,
  executorType: 'sandbox',
  executorConfig: {},
}

describe('TemplateResolver', () => {
  describe('resolveTemplate', () => {
    it('resolves workflowRunId', () => {
      expect(resolveTemplate('feat/{{workflowRunId}}', mockPayload)).toBe(
        'feat/wf-abc123',
      )
    })

    it('resolves stepName', () => {
      expect(resolveTemplate('step-{{stepName}}', mockPayload)).toBe(
        'step-implement',
      )
    })

    it('resolves tenantId', () => {
      expect(resolveTemplate('{{tenantId}}/data', mockPayload)).toBe(
        'tenant-xyz/data',
      )
    })

    it('resolves attempt', () => {
      expect(resolveTemplate('attempt-{{attempt}}', mockPayload)).toBe(
        'attempt-2',
      )
    })

    it('resolves multiple variables in one string', () => {
      expect(
        resolveTemplate(
          'https://github.com/{{tenantId}}/repo.git branch:feat/{{workflowRunId}}',
          mockPayload,
        ),
      ).toBe('https://github.com/tenant-xyz/repo.git branch:feat/wf-abc123')
    })

    it('resolves extra variables (secrets)', () => {
      expect(
        resolveTemplate(
          'https://{{GIT_TOKEN}}@github.com/org/repo.git',
          mockPayload,
          { GIT_TOKEN: 'ghp_secret123' },
        ),
      ).toBe('https://ghp_secret123@github.com/org/repo.git')
    })

    it('resolves input variables', () => {
      expect(resolveTemplate('Task: {{task}}', mockPayload)).toBe(
        'Task: add login page',
      )
    })

    it('leaves unresolved variables as-is', () => {
      expect(resolveTemplate('{{unknown}}', mockPayload)).toBe('{{unknown}}')
    })

    it('handles string with no variables', () => {
      expect(resolveTemplate('no variables here', mockPayload)).toBe(
        'no variables here',
      )
    })

    it('handles empty string', () => {
      expect(resolveTemplate('', mockPayload)).toBe('')
    })
  })

  describe('resolveTemplates', () => {
    it('resolves an array of templates', () => {
      const templates = [
        'git clone https://{{GIT_TOKEN}}@github.com/org/repo.git /workspace',
        'cd /workspace && git checkout -b feat/{{workflowRunId}}',
        'echo "Working on: {{task}}"',
      ]
      const result = resolveTemplates(templates, mockPayload, {
        GIT_TOKEN: 'token123',
      })
      expect(result).toEqual([
        'git clone https://token123@github.com/org/repo.git /workspace',
        'cd /workspace && git checkout -b feat/wf-abc123',
        'echo "Working on: add login page"',
      ])
    })

    it('handles empty array', () => {
      expect(resolveTemplates([], mockPayload)).toEqual([])
    })
  })
})

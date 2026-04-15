// npx vitest run src/__tests__/unit/template-resolver.spec.ts
import type { StepPayload } from '@goatlab/delphi-core'

/**
 * Resolves {{variable}} templates in strings using step payload context.
 * Supports: workflowRunId, stepName, tenantId, attempt
 * Also resolves custom variables from the input object.
 */
export function resolveTemplate(
  template: string,
  payload: StepPayload,
  extraVars?: Record<string, string>,
): string {
  let result = template
    .replace(/\{\{workflowRunId\}\}/g, payload.workflowRunId)
    .replace(/\{\{stepName\}\}/g, payload.stepName)
    .replace(/\{\{tenantId\}\}/g, payload.tenantId)
    .replace(/\{\{attempt\}\}/g, String(payload.attempt))

  // Resolve extra variables (e.g., secrets)
  if (extraVars) {
    for (const [key, value] of Object.entries(extraVars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
  }

  // Resolve from input (shallow)
  if (payload.input && typeof payload.input === 'object') {
    for (const [key, value] of Object.entries(payload.input)) {
      if (typeof value === 'string') {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
    }
  }

  return result
}

/**
 * Resolve templates in an array of strings.
 */
export function resolveTemplates(
  templates: string[],
  payload: StepPayload,
  extraVars?: Record<string, string>,
): string[] {
  return templates.map(t => resolveTemplate(t, payload, extraVars))
}

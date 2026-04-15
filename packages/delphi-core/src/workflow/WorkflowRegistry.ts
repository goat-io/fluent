// npx vitest run src/__tests__/workflow-builder.spec.ts
import { WorkflowNotFoundError } from '../errors/WorkflowErrors.js'
import type { WorkflowDefinition } from './WorkflowBuilder.types.js'

export class WorkflowRegistry {
  private definitions = new Map<string, WorkflowDefinition>()

  register(definition: WorkflowDefinition): void {
    this.definitions.set(definition.name, definition)
  }

  get(name: string): WorkflowDefinition {
    const def = this.definitions.get(name)
    if (!def) {
      throw new WorkflowNotFoundError(name)
    }
    return def
  }

  has(name: string): boolean {
    return this.definitions.has(name)
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.definitions.values())
  }

  names(): string[] {
    return Array.from(this.definitions.keys())
  }
}

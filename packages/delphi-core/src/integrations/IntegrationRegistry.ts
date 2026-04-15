// npx vitest run src/__tests__/engine/integrations.spec.ts
import type { Integration } from './Integration.js'

export class IntegrationRegistry {
  private integrations = new Map<string, Integration>()

  register(integration: Integration): this {
    this.integrations.set(integration.provider, integration)
    return this
  }

  get(provider: string): Integration {
    const integration = this.integrations.get(provider)
    if (!integration) {
      throw new Error(`Integration not found: "${provider}"`)
    }
    return integration
  }

  has(provider: string): boolean {
    return this.integrations.has(provider)
  }

  list(): string[] {
    return [...this.integrations.keys()]
  }
}

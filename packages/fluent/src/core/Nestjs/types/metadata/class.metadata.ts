import { DirectiveMetadata } from './directive.metadata'
import { PropertyMetadata } from './property.metadata'

export interface ClassMetadata {
  target: new (...args: any[]) => any
  name: string
  description?: string
  isAbstract?: boolean
  directives?: DirectiveMetadata[]
  extensions?: Record<string, unknown>
  properties?: PropertyMetadata[]
}

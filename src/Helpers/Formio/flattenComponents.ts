import { eachComponent } from './eachComponent'
import { FormioComponent } from './types/FormioComponent'

export interface IFlattenFormioComponents {
  [key: string]: FormioComponent
}
/**
 *
 * @param components
 * @param includeAll
 */
export const flattenComponents = (components: FormioComponent[], includeAll?: boolean) => {
  const flattened: IFlattenFormioComponents = {}
  eachComponent(
    components,
    (component, path) => {
      flattened[path] = component
    },
    includeAll
  )
  return flattened
}

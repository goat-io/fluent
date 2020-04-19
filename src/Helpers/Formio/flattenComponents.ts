import { eachComponent } from './eachComponent'
/**
 *
 * @param components
 * @param includeAll
 */
export const flattenComponents = (components: any, includeAll?: any) => {
  const flattened: any = {}
  eachComponent(
    components,
    (component: any, path: any) => {
      flattened[path] = component
    },
    includeAll
  )
  return flattened
}

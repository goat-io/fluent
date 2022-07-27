import { Objects } from '@goatlab/js-utils'
import { eachComponent } from './eachComponent'
import { FormioComponent } from './types/FormioComponent'
import { AnyObject } from '@goatlab/fluent'
/**
 *
 * @param component
 * @param query
 */
const matchComponent = (component: any, query: any) => {
  if (typeof query === 'string') {
    return component.key === query
  }
  let matches = false

  Object.keys(query).forEach(path => {
    matches = Objects.getFromPath(component, path).value === query[path]
    if (!matches) {
      return false
    }
  })
  return matches
}
/**
 * Recursively finds all components
 * matching a Mongo-like query
 * @param components
 * @param query
 */
export const findComponents = (
  components: FormioComponent[],
  query: AnyObject
): FormioComponent[] => {
  const results = []

  eachComponent(
    components,
    (component: any, path: any) => {
      if (matchComponent(component, query)) {
        component.path = path
        results.push(component)
      }
    },
    true
  )
  return results
}

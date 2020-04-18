import { Objects } from '../Objects'
import { eachComponent } from './eachComponent'
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
export const findComponents = (components: any, query: any) => {
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

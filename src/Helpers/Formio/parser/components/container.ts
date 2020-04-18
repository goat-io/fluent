import { FormioComponent } from '../../types/FormioComponent'
export const container = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }
  let path = component.path || component.key

  path = path.split('.').join('_')

  const validation = { isObject: true, path }

  return validation
}

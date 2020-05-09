import { FormioComponent } from '../types/FormioComponent'

export const datagrid = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  let path = component.path || component.key
  path = path.split('.').join('_')

  const validation = { isDatagrid: true, dgPath: path, __key: component.key }

  return validation
}

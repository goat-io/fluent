import { FormioComponent } from '../../types/FormioComponent'

export const selectBox = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  let path = component.path || component.key

  path = path.split('.').join('_')

  const validation: any = { isObject: true, path }

  if (component.values) {
    component.values.forEach(v => {
      validation[v.value] = {
        dbIndex: false,
        encrypted: false,
        required: false,
        type: 'boolean',
        unique: false
      }
    })
  }

  return validation
}

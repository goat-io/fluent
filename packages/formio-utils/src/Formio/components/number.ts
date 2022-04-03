import { FormioComponent } from '../types/FormioComponent'

export const numberComponent = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  let validation: any = { type: 'number' }
  if (component.multiple) {
    validation = { array: true, type: 'number' }
  }

  return validation
}

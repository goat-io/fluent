import { FormioComponent } from '../types/FormioComponent'

export const email = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  let validation: any = { type: 'string' }
  if (component.multiple) {
    validation = { array: true, type: 'string' }
  }

  return validation
}

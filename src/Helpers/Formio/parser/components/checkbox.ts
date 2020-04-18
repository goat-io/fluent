import { FormioComponent } from '../../types/FormioComponent'
export const checkbox = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  const validation = { type: 'boolean' }

  return validation
}

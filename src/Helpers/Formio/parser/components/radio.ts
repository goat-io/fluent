import { FormioComponent } from '../../types/FormioComponent'

export const radio = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  const validation: any = { type: 'string' }

  if (component.values) {
    const enumArray = []
    component.values.forEach(v => {
      enumArray.push(v.value)
    })
    validation.enum = enumArray
  }
  return validation
}

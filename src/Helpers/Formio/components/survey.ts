import { FormioComponent } from '../types/FormioComponent'

export const survey = (component: FormioComponent) => {
  if (!component) {
    throw new Error('You must provide a component to parse')
  }

  let path = component.path || component.key

  path = path.split('.').join('_')
  const validation = { isObject: true, path }

  if (component.questions) {
    if (component.values) {
      const enumArray = []
      component.values.forEach((v: any) => {
        enumArray.push(v.value)
      })

      component.questions.forEach((q: any) => {
        validation[q.value] = {
          dbIndex: false,
          encrypted: false,
          enum: enumArray,
          required: false,
          type: 'string',
          unique: false
        }
      })
    }
  }

  return validation
}

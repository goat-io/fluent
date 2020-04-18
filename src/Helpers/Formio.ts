import { eachComponent } from './Formio/eachComponent'
import { findComponents } from './Formio/findComponents'
import { flattenComponents } from './Formio/flattenComponents'
import { getter, setter } from './Formio/mutators'
import { FormioForm } from './Formio/types/FormioForm'

export const Formio = (() => {
  /**
   *
   * @param forms
   */
  const getFromJson = (forms): FormioForm[] => {
    const Forms = forms.models.Form
    const parsedForms = []

    Object.keys(Forms).forEach(formId => {
      const parsedForm = getter(JSON.parse(Forms[formId]))
      parsedForms.push(parsedForm)
    })
    return parsedForms
  }

  return Object.freeze({
    eachComponent,
    findComponents,
    flattenComponents,
    getFromJson,
    getter,
    setter
  })
})()

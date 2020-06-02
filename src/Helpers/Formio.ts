import { eachComponent } from './Formio/eachComponent'
import { findComponents } from './Formio/findComponents'
import { flattenComponents } from './Formio/flattenComponents'
import { labels } from './Formio/labels'
import { getter, setter } from './Formio/mutators'
import { tableViewComponents } from './Formio/tableView'
import { FormioForm } from './Formio/types/FormioForm'

export const Formio = (() => {
  /**
   *
   * @param forms
   */
  const getFromJson = (forms): FormioForm[] => {
    const Forms = forms && forms.models && forms.models.Form
    const parsedForms = []

    Object.keys(Forms).forEach(formId => {
      const parsedForm = getter(JSON.parse(Forms[formId]))
      parsedForms.push(parsedForm)
    })
    return parsedForms
  }

  const tableViewLabels = (form: FormioForm) => {
    const tableCols = tableViewComponents(form)
    let cols = tableCols.map(o => `${o.path}`)

    cols = [...cols, 'id', 'created', 'modified']

    return cols
  }

  return Object.freeze({
    eachComponent,
    findComponents,
    flattenComponents,
    getFromJson,
    getter,
    labels,
    setter,
    tableViewComponents,
    tableViewLabels
  })
})()

import { parse } from './Formio/parser/parse'
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
    if (!Forms) return []
    
    const formKeys = Object.keys(Forms)
    const parsedForms = new Array(formKeys.length)

    for (let i = 0; i < formKeys.length; i++) {
      parsedForms[i] = getter(JSON.parse(Forms[formKeys[i]]))
    }
    return parsedForms
  }

  const tableViewLabels = (form: FormioForm) => {
    const tableCols = tableViewComponents(form)
    const colsLength = tableCols.length
    const cols = new Array(colsLength + 3)
    
    for (let i = 0; i < colsLength; i++) {
      cols[i] = `${tableCols[i].path}`
    }
    
    cols[colsLength] = 'id'
    cols[colsLength + 1] = 'created'
    cols[colsLength + 2] = 'modified'

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
    tableViewLabels,
    parse
  })
})()

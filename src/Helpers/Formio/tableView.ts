import { findComponents } from './findComponents'
import { FormioForm } from './types/FormioForm'

export const tableViewComponents = (form: FormioForm) => {
  return findComponents(form.components, {
    input: true,
    tableView: true
  }).filter(c => {
    return !!(c.label !== '')
  })
}

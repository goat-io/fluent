import { Objects } from '../../../Helpers/Objects'
import { Errors } from '../../Errors'
import { flattenComponents } from '../../Formio/flattenComponents'
import { FormioComponent } from '../types/FormioComponent'
import { FormioForm } from '../types/FormioForm'
import { checkbox } from './components/checkbox'
import { container } from './components/container'
import { datagrid } from './components/datagrid'
import { email } from './components/email'
import { numberComponent } from './components/number'
import { password } from './components/password'
import { phoneNumber } from './components/phonenumber'
import { radio } from './components/radio'
import { select } from './components/select'
import { selectBox } from './components/selectbox'
import { survey } from './components/survey'
import { textField } from './components/textfield'

/**
 *
 * @param component
 */
const getComponentTypes = (component: FormioComponent) => {
  if (component.key === 'submit') {
    return undefined
  }
  let validation: any = {}

  switch (component && component.type && component.type.toLowerCase()) {
    case 'textfield':
      validation = textField(component)
      break
    case 'number':
      validation = numberComponent(component)
      break
    case 'checkbox':
      validation = checkbox(component)
      break
    case 'email':
      validation = email(component)
      break
    case 'select':
      validation = select(component)
      break
    case 'selectboxes':
      validation = selectBox(component)
      break
    case 'container':
      validation = container(component)
      break
    case 'phonenumber':
      validation = phoneNumber(component)
      break
    case 'password':
      validation = password(component)
      break
    case 'radio':
      validation = radio(component)
      break
    case 'survey':
      validation = survey(component)
      break
    case 'datagrid':
      validation = datagrid(component)
      break
    default:
      validation = { type: 'string' }
      break
  }

  validation.required = component.validate && !!component.validate.required
  validation.encrypted = !!component.encrypted
  validation.unique = !!component.unique
  validation.dbIndex = !!component.dbIndex
  return validation
}

/**
 * Given a Formio form, it generates the schema and types
 * of the submission data object
 * @param Form
 */
export const getFormDataObject = (Form: FormioForm) => {
  if (!Form) {
    throw Errors(null, 'No Forms were loaded')
  }
  const flattenForm = flattenComponents(Form.components)
  let dataObject = {}
  Object.keys(flattenForm).forEach(path => {
    if (!dataObject[path]) {
      dataObject[path] = getComponentTypes(flattenForm[path])
    }
  })

  dataObject = Objects.clone(Objects.nest(dataObject))
  return dataObject
}

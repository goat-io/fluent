import { Objects } from '@goatlab/js-utils'
import { FormioForm } from './types/FormioForm'
import { FormioStringForm } from './types/FormioStringForm'
/**
 * String to Components. Converts a Formio stored form instance,
 * to a usable none stringified version
 * @param form
 */
export const getter = (form: FormioStringForm): FormioForm => {
  const editForm = Objects.clone(form)

  if (editForm.components) {
    editForm.components = JSON.parse(editForm.components)
  }
  return editForm
}

/**
 * Components to String. Converts a Formio form into a storable
 * instance where the components are a single string
 * @param form
 */
export const setter = (form: FormioForm): FormioStringForm => {
  const editForm = Objects.clone(form)

  if (editForm.components) {
    editForm.components = JSON.stringify(editForm.components)
  }
  return editForm
}

import { InvocationContext } from '@loopback/core'
import { For } from '../../Helpers/For'
import { Validate } from '../../Helpers/Formio/validator/Validate'
import { FormioForm } from '../../Helpers/Formio/types/FormioForm'
import { Errors } from '../../Helpers/Errors'
import { Changelog } from '../../Helpers/Changelog'

const goatExtendedValues = [
  'id',
  'owner',
  'roles',
  '_ngram',
  'form',
  'created',
  'deleted',
  'modified'
]
/**
 *
 * @param ctx
 * @param next
 */
export const validateSubmission = async (ctx: any, next) => {
  const invocation: InvocationContext = ctx
  const method = invocation.methodName
  const targetClass: any = invocation.target

  const form: FormioForm = await targetClass.formRepository.getFormById(
    targetClass.baseFormId
  )

  const isPatch = ['updateById'].includes(method)
  const isPut = ['replaceById'].includes(method)
  const argsIndex = ['replaceById', 'updateById'].includes(method) ? 1 : 0
  let submission = invocation.args[argsIndex]

  if (isPut || isPatch) {
    const id = ctx.args[0]
    const currentValue = await targetClass.model_Repository.findById(id)
    goatExtendedValues.forEach(key => {
      delete currentValue[key]
    })
    console.log('currentValue', currentValue)
    submission = isPut ? submission : { ...currentValue, ...submission }
    console.log('newValue', submission)

    const changelog = Changelog.get({
      previous: currentValue,
      current: submission,
      author: 'ANONYMOUS'
    })

    console.log('changelog', changelog)
  }
  // Pre-process the request
  const [error, validated] = await For.async(
    Validate.submission(form, { data: submission })
  )

  if (error || !validated) {
    console.log('error', error)

    throw Errors(error, 'Validation error. Your Form has errors', {
      code: 422
    }).httpError
  }

  // The pre proccesed element
  ctx.args[argsIndex] = validated

  try {
    const result = await next()
    // Post-process the response
    return result
  } catch (err) {
    // Handle errors
    throw err
  }
}

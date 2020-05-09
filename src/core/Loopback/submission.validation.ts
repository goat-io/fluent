import { InvocationContext } from '@loopback/core'
import { For } from '../../Helpers/For'
import Validate from '../../Helpers/Formio/validator/Validate'
import { FormioForm } from '../../Helpers/Formio/types/FormioForm'
import { Errors } from '../../Helpers/Errors'
/**
 *
 * @param ctx
 * @param next
 */
export const validateSubmission = async (ctx: any, next) => {
  const invocation: InvocationContext = ctx
  const method = invocation.methodName
  const targetClass: any = invocation.target

  const formId: string = targetClass.baseFormId
  const form: FormioForm = await targetClass.formRepository.getFormById(formId)

  const isPatch = ['updateById'].includes(method)
  const argsIndex = ['replaceById', 'updateById'].includes(method) ? 1 : 0

  const submission = invocation.args[argsIndex]

  // Pre-process the request
  const [error, validated] = await For.async(Validate.submission(form, { data: submission }))

  if (error || !validated) {
    console.log('error', error)

    throw Errors(error, 'Validation error. Your Form has errors', {
      code: 422
    }).httpError
  }

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

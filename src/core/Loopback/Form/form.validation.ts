import { Interceptor, InvocationContext, ValueOrPromise } from '@loopback/core'
import { to } from 'await-to-js'
import { Errors } from '../../../Helpers/Errors'
import { Formio } from '../../../Helpers/Formio'
import { Validate } from '../../../Helpers/Formio/validator/Validate'

export const validateForm: Interceptor = async (ctx: InvocationContext, next: ValueOrPromise<any>) => {
  const method = ctx.methodName
  const isPatch = ['updateById'].includes(method)
  const argsIndex = ['replaceById', 'updateById'].includes(method) ? 1 : 0
  let submission = ctx.args[argsIndex]

  if (isPatch) {
    const _id = ctx.args[0]
    const target: any = ctx.target
    const form = await target.formRepository.findById(_id)
    submission = { ...form, ...submission }
  }

  submission = Formio.getter(submission)

  let [error, validated] = await to(Validate.form(submission))

  if (error || !validated) {
    throw Errors(error, 'Validation error. Your Form has errors', {
      code: 422
    }).httpError
  }

  const stringForm = Formio.setter(validated)

  ctx.args[argsIndex] = stringForm

  const result = await next()
  return result
}

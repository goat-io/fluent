import type { AnyObject } from '@goatlab/fluent'
import { Promises } from '@goatlab/js-utils'
import { FormioForm } from '../types/FormioForm'
import Form from './Form/Form'
import { Validator } from './Logic/Validator'
import Submission from './Submission/Submission'

interface FormioError {
  message: string
  path: string[]
  type: string
  context: AnyObject
}
export interface FormioValidationError {
  name: string
  details: FormioError[]
}

export const Validate = (() => {
  const validate = (
    form: FormioForm,
    submissions: AnyObject[]
  ): Promise<AnyObject[]> => {
    const Submissions: AnyObject[] = JSON.parse(JSON.stringify(submissions))

    return new Promise((resolve, reject) => {
      Submission(form.path).then(model => {
        const validation = new Validator(form, model)
        const validationPromises: Promise<any>[] = []

        Submissions.forEach((sub: any) => {
          validationPromises.push(
            new Promise((res, rej) => {
              validation.validate(sub, (err: any, su: any) => {
                if (err) {
                  return rej(err)
                }
                return res(su)
              })
            })
          )
        })

        Promise.all(validationPromises)
          .then(res => resolve(res))
          .catch(e => {
            const errors: FormioValidationError = {
              name: e.name,
              details: e.details
            }
            return reject(errors)
          })
      })
    })
  }

  const submissions = (form: FormioForm, submissions: AnyObject[]) =>
    validate(form, submissions)

  const submission = async (
    form: FormioForm,
    submission: AnyObject
  ): Promise<AnyObject> => {
    const Submissions = [submission]
    const [error, subs] = await Promises.try<AnyObject, any>(
      validate(form, Submissions)
    )
    if (error) {
      const errors: FormioValidationError = {
        name: error.name,
        details: error.details
      }
      return Promise.reject(errors)
    }
    return subs[0]
  }
  /**
   *
   * @param forms
   */
  const form = (forms: FormioForm): Promise<FormioForm> => {
    const Forms = JSON.parse(
      JSON.stringify(forms, (_key, value) =>
        value === null ? undefined : value
      )
    )

    return new Promise((resolve, reject) => {
      const formsIsNotArray = !Array.isArray(Forms)

      if (formsIsNotArray) {
        const f = new Form(Forms)
        f.validate((err: any) => {
          if (err) {
            reject(err)
            return
          }

          resolve(Forms)
        })

        return
      }

      const validationPromises: Promise<any>[] = []
      Forms.forEach((f: FormioForm) => {
        validationPromises.push(
          new Promise((res, rej) => {
            const formModel = new Form(f)
            formModel.validate((err: any) => {
              if (err) {
                rej(err)
                return
              }
              res(f)
            })
          })
        )
      })

      Promise.all(validationPromises)
        .then((res: any) => {
          resolve(res)
        })
        .catch(e => {
          reject(e)
        })
    })
  }

  return Object.freeze({
    submission,
    submissions,
    form
  })
})()

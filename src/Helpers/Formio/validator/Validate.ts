import { FormioForm } from '../types/FormioForm'
import Form from './Form/Form'
import Submission from './Submission/Submission'
import { IDataElement } from '../../../BaseConnector'
import { Validator } from './Logic/Validator'
import { For } from '../../For'

interface FormioError {
  message: string
  path: string[]
  type: string
  context: IDataElement
}
export interface FormioValidationError {
  name: string
  details: FormioError[]
}

export const Validate = (() => {
  const validate = (form: FormioForm, submissions: IDataElement[]): Promise<IDataElement[]> => {
    const _submissions: IDataElement[] = JSON.parse(JSON.stringify(submissions))

    return new Promise((resolve, reject) => {
      Submission(form.path).then((model) => {
        const validation = new Validator(form, model)
        const validationPromises: Promise<any>[] = []

        _submissions.forEach((sub: any) => {
          validationPromises.push(
            new Promise(async (res, rej) => {
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
          .then((res) => {
            return resolve(res)
          })
          .catch((e) => {
            const errors: FormioValidationError = { name: e.name, details: e.details }
            return reject(errors)
          })
      })
    })
  }

  const submissions = (form: FormioForm, submissions: IDataElement[]) => {
    return validate(form, submissions)
  }

  const submission = async (form: FormioForm, submission: IDataElement): Promise<IDataElement> => {
    const _submissions = [submission]
    const [error, subs] = await For.async<IDataElement, any>(validate(form, _submissions))
    if (error) {
      const errors: FormioValidationError = { name: error.name, details: error.details }
      return Promise.reject(errors)
    }
    return subs[0]
  }
  /**
   *
   * @param forms
   */
  const form = (forms: FormioForm): Promise<FormioForm> => {
    const _forms = JSON.parse(
      JSON.stringify(forms, (key, value) => {
        return value === null ? undefined : value
      })
    )

    return new Promise((resolve, reject) => {
      const formsIsNotArray = !Array.isArray(_forms)

      if (formsIsNotArray) {
        const f = new Form(_forms)
        f.validate((err: any) => {
          if (err) {
            reject(err)
            return
          }

          resolve(_forms)
          return
        })

        return
      }

      const validationPromises: Promise<any>[] = []
      _forms.forEach((f: FormioForm) => {
        validationPromises.push(
          new Promise((res, rej) => {
            const formModel = new Form(f)
            formModel.validate((err: any) => {
              if (err) {
                rej(err)
                return
              }
              res(f)
              return
            })
          })
        )
      })

      Promise.all(validationPromises)
        .then((res: any) => {
          resolve(res)
        })
        .catch((e) => {
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

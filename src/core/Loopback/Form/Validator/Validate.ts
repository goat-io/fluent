import { FormioForm } from '../../../../Helpers/Formio/types/FormioForm'
import Form from './Form/Form'
import Submission from './Submission/Submission'
const Validator = require('./Validator')

export default (() => {
  const submission = (FormDefinition: FormioForm, submissions: any) => {
    const _submissions = JSON.parse(JSON.stringify(submissions))
    return new Promise((resolve, reject) => {
      Submission(FormDefinition.path).then(model => {
        const submissionsIsNotArray = !Array.isArray(_submissions)
        const validation = new Validator(form, model)
        if (submissionsIsNotArray) {
          validation.validate(_submissions, (error: any, sub: any) => {
            if (error) {
              reject(error)
            }
            _submissions.data = sub
            resolve(_submissions)
          })
          return
        }
        const validationPromises: Promise<any>[] = []
        _submissions.forEach((sub: any) => {
          validationPromises.push(
            new Promise((res, rej) => {
              validation.validate(sub, (err: any, su: any) => {
                const subCopy = JSON.parse(JSON.stringify(sub))
                if (err) {
                  rej(err)
                }
                subCopy.data = su
                res(subCopy)
              })
            })
          )
        })

        Promise.all(validationPromises)
          .then(res => {
            resolve(res)
          })
          .catch(e => {
            reject(e)
          })
      })
    })
  }

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
        .catch(e => {
          reject(e)
        })
    })
  }

  return Object.freeze({
    submission,
    form
  })
})()

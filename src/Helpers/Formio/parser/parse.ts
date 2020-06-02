import { Objects } from '../../Objects'
import { FormioForm } from '../types/FormioForm'
import { GoatParsedModel } from '../types/GoatParsedModel'
import { generateGoatModels } from './generateModels'
import { generateControllers } from './generators/controllers'
import { generateModels as generateBaseModels } from './generators/model'
import { loadedModules } from './generators/modules'
import { generateRepositories } from './generators/repositories'
import { generateTypes } from './generators/type'

export enum SupportedFrameworks {
  Loopback = 'Loopback4',
  Nest = 'Nestjs'
}
/*
const to = require('await-to-js').default
const generateModels = require('./generateModels')
const dbForms = require('../../../Providers/database')
const jsonForms = require('../../../Providers/json')
const formioForms = require('../../../Providers/formio')
import { Errors } from '../../Errors'


const loadForms = async config => {
  let error
  let forms
  const source = config.source.toLowerCase()

  switch (source) {
    case 'formio':
      Logger().info('Getting Forms from Formio')
      ;[error, forms] = await to(formioForms.load())
      break
    case 'db':
      Logger().info('Getting Forms from DB')
      ;[error, forms] = await to(dbForms.load())
      break
    case 'json':
      Logger().info('Getting Forms from JSON')
      const { path } = config
      ;[error, forms] = await to(jsonForms.load({ path }))
      break
    default:
      break
  }

  if (error) {
    throw Errors(error, `Could not load the Forms from source ${source}`)
  }
  Logger().info('FORMS LOADED')

  forms = forms.map(f => {
    f = formGetter(f)
    return f
  })

  return generateModels(forms)
}
*/

export const parse = async (
  Form: FormioForm | FormioForm[],
  framework: SupportedFrameworks
): Promise<GoatParsedModel[]> => {
  const formModels = await generateGoatModels(
    !Array.isArray(Form) ? [Form] : Form
  )

  if (Objects.isEmpty(formModels)) {
    throw new Error('Could not parse the given form')
  }

  const parsedResults: GoatParsedModel[] = []
  const modules = loadedModules(formModels, framework)

  formModels.forEach(formModel => {
    const types = generateTypes(formModel)
    const models = generateBaseModels(formModel, framework)
    const module = loadedModules(formModel, framework)
    const repository = generateRepositories(formModel, framework)
    const controller = generateControllers(formModel, framework)
    const parsedModel: GoatParsedModel = {
      controller,
      model: formModel,
      models,
      module,
      modules,
      repository,
      types
    }
    parsedResults.push(parsedModel)
  })

  return parsedResults
}

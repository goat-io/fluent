import { compile, registerHelper, registerPartial } from 'handlebars'
import { join } from 'path'
import { GoatModel } from '../../types/GoatModel'
import { SupportedFrameworks } from '../parse'
import { metaProperties } from './metaProperties'
import { template as lbTypes } from './templates/Loopback4/model/_typesProperty.hbs'
import { template as lbModelBase } from './templates/Loopback4/model/baseModel.hbs'
import { template as lbModelExtended } from './templates/Loopback4/model/model.hbs'

const FrameworkTemplatesBaseModel = {
  Loopback4: lbModelBase
}

const FrameworkTemplatesModelExtended = {
  Loopback4: lbModelExtended
}

const FrameworkTypes = {
  Loopback4: lbTypes
}
export const generateModels = (Model: GoatModel, framework: SupportedFrameworks) => {
  const datagrids = generateDatagrids(Model, framework)
  const objects = generateObject(Model, framework)
  const baseModel = generateBaseModel(Model, framework)
  const extendedModels = generateExtendedModel(Model, framework)

  return {
    baseModels: [...datagrids, ...objects, baseModel],
    extendedModels
  }
}

const generateBaseModel = (Model, framework: SupportedFrameworks) => {
  const source = FrameworkTemplatesBaseModel[framework]

  const partial = FrameworkTypes[framework]

  registerPartial('typeProperty', partial)

  registerHelper('IfMetaNotProperty', function(element, options) {
    if (metaProperties.includes(element)) {
      return
    }
    return options.fn(this)
  })

  registerHelper('ifIsId', function(element, options) {
    if (element === '_id') {
      return options.fn(this)
    }
    return
  })

  registerHelper('ifIsNotId', function(element, options) {
    if (element === '_id') {
      return
    }
    return options.fn(this)
  })

  registerHelper('stringToJsType', (element, options) => {
    if (element === 'string') {
      return 'String'
    } else if (element === 'number') {
      return 'Number'
    }
  })

  const template = compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const filePath = join(`${Model.folderPath}/_base/models/${Model.name}-model.ts`)
  // writeFileSync(filePath, result)
  return {
    file: result,
    path: filePath
  }
}

const generateExtendedModel = (Model: GoatModel, framework: SupportedFrameworks) => {
  const sourceExtended = FrameworkTemplatesModelExtended[framework]
  const templateExtended = compile(sourceExtended)
  const resultExtended = templateExtended(Model.properties)
  const filePathExtended = join(`${Model.folderPath}/${Model.name}.model.ts`)
  // writeFileSync(filePathExtended, resultExtended)
  return {
    file: resultExtended,
    path: filePathExtended
  }
}

const generateDatagrids = (Model: GoatModel, framework: SupportedFrameworks) => {
  const datagrids: any = []
  Object.keys(Model.__datagrids).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__datagrids[ModelName]
    model.folderPath = Model.folderPath
    datagrids.push(generateBaseModel(model, framework))
  })
  return datagrids
}

const generateObject = (Model: GoatModel, framework: SupportedFrameworks) => {
  const objects: any = []
  Object.keys(Model.__objects).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__objects[ModelName]
    model.folderPath = Model.folderPath
    objects.push(generateBaseModel(model, framework))
  })
  return objects
}

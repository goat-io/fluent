import Handlebars from 'handlebars'
import { join } from 'path'
import { FluentModel } from '../../types/FluentModel'
import { SupportedFrameworks } from '../parse'
import { metaProperties } from './metaProperties'
import { template as lbTypes } from './templates/Loopback4/model/_typesProperty.hbs'
import { template as lbModelBase } from './templates/Loopback4/model/baseModel.hbs'
import { template as lbModelExtended } from './templates/Loopback4/model/model.hbs'

import { template as lbFaker } from './templates/Loopback4/model/_fakeObject.hbs'

import { template as nestTypes } from './templates/Nestjs/model/_typesProperty.hbs'
import { template as nestModelBase } from './templates/Nestjs/model/baseModel.hbs'
import { template as nestModelExtended } from './templates/Nestjs/model/model.hbs'

import { template as nestFaker } from './templates/Nestjs/model/_fakeObject.hbs'

import { template as dtoTemplate } from './templates/Nestjs/model/baseDto.hbs'

const FrameworkTemplatesBaseModel = {
  Loopback4: lbModelBase,
  Nestjs: nestModelBase
}

const FrameworkTemplatesModelExtended = {
  Loopback4: lbModelExtended,
  Nestjs: nestModelExtended
}

const FrameworkTypes = {
  Loopback4: lbTypes,
  Nestjs: nestTypes
}

const FrameworkFaker = {
  Loopback4: lbFaker,
  Nestjs: nestFaker
}

export const generateModels = (
  Model: FluentModel,
  framework: SupportedFrameworks
) => {
  const datagrids = generateDatagrids(Model, framework)
  const objects = generateObject(Model, framework)
  const baseModel = generateBaseModel(Model, framework)
  const extendedModels = generateExtendedModel(Model, framework)
  const generateDtoModel = generateDto(Model, framework)

  return {
    baseDto: generateDtoModel,
    baseModels: [...datagrids, ...objects, baseModel],
    extendedModels
  }
}

const generateBaseModel = (
  Model,
  framework: SupportedFrameworks,
  isChild?: boolean,
  isArray?: boolean
) => {
  const source = FrameworkTemplatesBaseModel[framework]
  const partial = FrameworkTypes[framework]
  const partialFaker = FrameworkFaker[framework]

  Handlebars.registerPartial('typeProperty', partial)
  Handlebars.registerPartial('fakerObject', partialFaker)

  Handlebars.registerHelper('IfMetaNotProperty', function (element, options) {
    if (metaProperties.includes(element)) {
      return
    }
    return options.fn(this)
  })

  Handlebars.registerHelper('ifIsId', function (element, options) {
    if (element === 'id') {
      return options.fn(this)
    }
  })

  Handlebars.registerHelper('ifIsNotId', function (element, options) {
    if (element === 'id') {
      return
    }
    return options.fn(this)
  })

  Handlebars.registerHelper('stringToJsType', (element, options) => {
    if (element === 'string') {
      return 'String'
    }
    if (element === 'number') {
      return 'Number'
    }
  })

  Handlebars.registerHelper('stringToFaker', (element, array, options) => {
    if (element === 'string') {
      return array
        ? '[faker.random.word().split(" ")[0], faker.random.word().split(" ")[0], faker.random.word().split(" ")[0]]'
        : 'faker.random.word().split(" ")[0]'
    }
    if (element === 'number') {
      return array
        ? '[faker.random.number(), faker.random.number(), faker.random.number()]'
        : 'faker.random.number()'
    }
    if (element === 'boolean') {
      return array
        ? '[faker.random.boolean(), faker.random.boolean(), faker.random.boolean()]'
        : 'faker.random.boolean()'
    }
  })

  const template = Handlebars.compile(source)
  Model.properties._Model = Model
  Model.properties._Model.isChild = isChild
  Model.properties._Model.isMain = !isChild
  Model.properties._Model.isArray = isArray
  const result = template(Model.properties)

  const folderName =
    framework === SupportedFrameworks.Loopback ? 'models' : 'entities'

  const modelName =
    framework === SupportedFrameworks.Loopback ? 'model' : 'entity'

  const filePath = join(
    `${Model.folderPath}/_base/${folderName}/${Model.name}-${modelName}.ts`
  )
  // writeFileSync(filePath, result)
  return {
    file: result,
    path: filePath
  }
}

const generateExtendedModel = (
  Model: FluentModel,
  framework: SupportedFrameworks
) => {
  const modelName =
    framework === SupportedFrameworks.Loopback ? 'model' : 'entity'

  const sourceExtended = FrameworkTemplatesModelExtended[framework]
  const templateExtended = Handlebars.compile(sourceExtended)
  const resultExtended = templateExtended(Model.properties)
  const filePathExtended = join(
    `${Model.folderPath}/${Model.name}.${modelName}.ts`
  )
  // writeFileSync(filePathExtended, resultExtended)
  return {
    file: resultExtended,
    path: filePathExtended
  }
}

const generateDatagrids = (
  Model: FluentModel,
  framework: SupportedFrameworks
) => {
  const datagrids: any = []
  Object.keys(Model.__datagrids).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__datagrids[ModelName]
    model.folderPath = Model.folderPath
    model.isDataGrid = true
    datagrids.push(generateBaseModel(model, framework, true, true))
  })
  return datagrids
}

const generateObject = (Model: FluentModel, framework: SupportedFrameworks) => {
  const objects: any = []
  Object.keys(Model.__objects).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__objects[ModelName]
    model.folderPath = Model.folderPath
    objects.push(generateBaseModel(model, framework, true))
  })
  return objects
}

const generateDto = (Model: FluentModel, framework: SupportedFrameworks) => {
  const source = dtoTemplate
  const template = Handlebars.compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const filePath = join(`${Model.folderPath}/${Model.name}.dto.ts`)
  // writeFileSync(filePath, result)
  return {
    file: result,
    path: filePath
  }
}

import Handlebars from 'handlebars'
import { join } from 'path'
import { FluentModel } from '../../types/FluentModel'
import { metaProperties } from './metaProperties'
import { template as typesProperty } from './templates/types/_typesProperty.hbs'
import { template as jstypes } from './templates/types/types.hbs'

const generateDatagrids = (Model: FluentModel) => {
  const datagrids: any = []

  Object.keys(Model.__datagrids).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__datagrids[ModelName]
    model.folderPath = Model.folderPath
    datagrids.push(generateType(model))
  })
  return datagrids
}

const generateObject = (Model: FluentModel) => {
  const objects: any = []
  Object.keys(Model.__objects).forEach(ModelName => {
    const model: any = {}
    model.name = ModelName
    model.properties = Model.__objects[ModelName]
    model.folderPath = Model.folderPath
    objects.push(generateType(model))
  })
  return objects
}

const generateType = (Model: any) => {
  const source = jstypes
  const partial = typesProperty

  Handlebars.registerPartial('typeProperty', partial)
  Handlebars.registerHelper('IfNotMetaProperty', function (element, options) {
    if (metaProperties.includes(element)) {
      return
    }

    return options.fn(this)
  })

  Handlebars.registerHelper('getDatagrids', (element, options) => {
    const datagrid = []
    Object.keys(element).forEach(property => {
      if (!metaProperties.includes(property)) {
        if (element[property].isDatagrid) {
          datagrid.push({ path: `${element.path}_${property}` })
        }
      }
    })
    return options.fn(datagrid)
  })

  Handlebars.registerHelper('getDatagrid', (element, options) => {
    let datagrid = { path: '../' }
    Object.keys(element).forEach(property => {
      if (!metaProperties.includes(property)) {
        if (element[property].isDatagrid) {
          datagrid = { path: `${element.path}_${property}` }
        }
      }
    })
    return options.fn(datagrid)
  })

  const template = Handlebars.compile(source)
  Model.properties._Model = Model
  const result = template(Model.properties)

  const filePath = join(`${Model.folderPath}/_base/types/${Model.name}.type.ts`)

  return {
    file: result,
    path: filePath
  }
}

export const generateTypes = (Model: FluentModel) => {
  const datagrids = generateDatagrids(Model)
  const objects = generateObject(Model)
  const types = generateType(Model)

  return [...datagrids, ...objects, types]
}

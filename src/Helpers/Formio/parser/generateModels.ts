import { Objects } from '../../Objects'
import { findComponents } from '../findComponents'
import { FormioComponent } from '../types/FormioComponent'
import { FormioForm } from '../types/FormioForm'
import { GoatModel } from '../types/GoatModel'
import { selectBox as getSelectBoxes } from '../components/selectbox'
import { survey as getSurvey } from '../components/survey'
import { baseModel } from './getBaseModel'
import { getFormDataObject } from './getFormDataObject'
import { getRelations } from './getRelations'

const findDataGrids = (components: FormioComponent[]) => {
  const dataGrids = findComponents(components, {
    type: 'datagrid'
  })

  if (!dataGrids || dataGrids.length === 0) {
    return {}
  }

  const models = {}
  dataGrids.forEach((dataGrid: any) => {
    // Remove dot notation from paths as they
    // will become class names
    const dataGridPath: string = dataGrid.path.split('.').join('_')

    const dataObjects = getFormDataObject({ components: dataGrid.components })

    Object.keys(dataObjects).forEach(dataObject => {
      if (dataObjects[dataObject].isObject) {
        dataObjects[dataObject].path = `${dataGridPath}_${dataObject}`
      }
    })

    models[dataGridPath] = dataObjects
  })

  return models
}

const findObjects = (components: FormioComponent[]) => {
  const selectBoxes = findComponents(components, {
    type: 'selectboxes'
  })
  const containers = findComponents(components, {
    type: 'container'
  })

  const surveys = findComponents(components, {
    type: 'survey'
  })

  const objects: FormioComponent[] = [...selectBoxes, ...containers, ...surveys]

  if (!objects || objects.length === 0) {
    return {}
  }

  const models = {}
  objects.forEach((object: FormioComponent) => {
    let objectPath = object.path
    objectPath = objectPath.split('.').join('_')
    let dataObject = getFormDataObject({ components: object.components })

    if (object.type === 'survey') {
      dataObject = getSurvey(object)
    }
    if (object.type === 'selectboxes') {
      dataObject = getSelectBoxes(object)
    }

    models[objectPath] = dataObject
  })
  return models
}

export const generateGoatModels = async (
  forms: FormioForm[]
): Promise<GoatModel[]> => {
  const relations = getRelations(forms)

  const Models: GoatModel[] = []

  for (const form of forms) {
    const DoNotGenerate = []

    if (DoNotGenerate.includes(form.path) || form.type === 'form') {
      continue
    }
    const Model = Objects.clone(baseModel)
    Model.name = form.name
    const data = getFormDataObject(form)

    Object.keys(data).forEach(attribute => {
      Model.properties[attribute] = data[attribute]
    })

    Model.options.mongodb.collection = Model.name

    Model.mixins.Related.models = relations[form.path]
    // eslint-disable-next-line no-underscore-dangle
    Model.mixins.FormSelection.id = form.id

    Model.path = form.path
    Model.id = form.id
    Model.folderPath = `${form.path}`.split('/').join('__')

    const hasNGram = findComponents(form.components, {
      type: 'textfield',
      path: '_ngram'
    })

    if (hasNGram) {
      Model.mixins.Search.enabled = true
      Model.mixins.Search.fullText = findComponents(form.components, {
        'properties.search': 'text'
      }).map(f => f.key)
      Model.mixins.Search.nGram = findComponents(form.components, {
        'properties.search': 'fuzzy'
      }).map(f => f.key)
    }

    Model.__datagrids = findDataGrids(form.components)

    Model.__objects = findObjects(form.components)

    Models.push(Model)
  }
  return Models
}

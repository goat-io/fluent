import { Document, Schema, Model, model } from 'mongoose'

import { AccessType } from '../../types/AccessType'
import baseModel from '../Form/BaseModel'

export interface ISubmission extends Document {
  form: string
  owner: string
  deleted: number
  roles: string[]
  access: AccessType[]
}

interface Models {
  [key: string]: any
}
const models: Models = {}

const ModelDefinition = () => {
  return baseModel({
    schema: new Schema({
      type: Schema.Types.Mixed
    })
  })
}

const getModel = async (modelName: string) => {
  if (!models[modelName]) {
    const definition: Model<ISubmission> = model(modelName, ModelDefinition().schema, modelName)
    models[modelName] = definition
  }

  return models[modelName]
}

export default getModel

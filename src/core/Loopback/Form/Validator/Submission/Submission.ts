import { Document, Schema, Model, model } from 'mongoose'

import utils from '../utils'

import AccessSchema from './AccessSchema'

import { AccessType } from '../../../../../Helpers/Formio/types/AccessType'

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
  // eslint-disable-next-line global-require
  const m = require('./BaseModel')({
    schema: new Schema({
      form: {
        type: Schema.Types.ObjectId,
        ref: 'form',
        index: true,
        required: true
      },
      owner: {
        type: Schema.Types.Mixed,
        ref: 'submission',
        index: true,
        default: null,
        set: (owner: string) => {
          // Attempt to convert to objectId.
          return utils.ObjectId(owner)
        },
        get: (owner: string) => {
          return owner ? owner.toString() : owner
        }
      },
      deleted: {
        type: Number,
        default: null
      },
      roles: {
        type: [Schema.Types.ObjectId],
        ref: 'role',
        index: true
      },
      access: {
        type: [AccessSchema()],
        index: true
      },
      data: {
        type: Schema.Types.Mixed,
        required: true
      }
    })
  })

  m.schema.index(
    {
      deleted: 1
    },
    {
      partialFilterExpression: { deleted: { $eq: null } }
    }
  )

  m.schema.index({
    form: 1,
    deleted: 1,
    created: -1
  })

  return m
}

const getModel = async (modelName: string) => {
  if (!models[modelName]) {
    const definition: Model<ISubmission> = model(modelName, ModelDefinition().schema, modelName)
    models[modelName] = definition
  }

  return models[modelName]
}

export default getModel

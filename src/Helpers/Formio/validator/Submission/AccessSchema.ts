import { Schema } from 'mongoose'

export default () => {
  return new Schema({
    type: {
      type: String,
      enum: ['read', 'write', 'admin'],
      default: 'read',
      required: 'A permission type is required to associate an available permission with a Resource.'
    },
    resources: {
      type: [Schema.Types.ObjectId],
      ref: 'form'
    }
  })
}

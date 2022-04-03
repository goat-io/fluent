import { Document, Schema, Model, model } from 'mongoose'
import baseModel from './BaseModel'
import PermissionSchema from './PermissionSchema'
import { FormioForm } from '../../types/FormioForm'

const _ = require('lodash')
const util = require('../utils').default

export interface IForm extends FormioForm, Document {}

// All of these are generic component "FORM" functions
const componentKeys = (components: any[]) => {
  const keys: string[] = []
  util.eachComponent(
    components,
    (component: any) => {
      if (
        component.key &&
        !_.isUndefined(component.key) &&
        !_.isNull(component.key)
      ) {
        keys.push(component.key)
      }
    },
    true
  )
  return _(keys)
}

const componentPaths = (components: any[]) => {
  const paths: string[] = []
  util.eachComponent(
    components,
    (component: any, path: string) => {
      if (
        component.input &&
        !_.isUndefined(component.key) &&
        !_.isNull(component.key)
      ) {
        paths.push(path)
      }
    },
    true
  )
  return _(paths)
}

const componentShortcuts = (components: any[]) => {
  const shortcuts: string[] = []
  util.eachComponent(
    components,
    (component: any, path: string) => {
      if (component.shortcut) {
        shortcuts.push(_.capitalize(component.shortcut))
      }
      if (component.values) {
        _.forEach(component.values, (value: any) => {
          const shortcut = _.get(value, 'shortcut')
          if (shortcut) {
            shortcuts.push(_.capitalize(shortcut))
          }
        })
      }
    },
    true
  )
  return _(shortcuts)
}

const ModelDefinition = () => {
  const invalidRegex = /[^0-9a-zA-Z\-\/]|^\-|\-$|^\/|\/$/
  const validKeyRegex = /^(\w|\w[\w-.]*\w)$/
  const validShortcutRegex = /^([A-Z]|Enter|Esc)$/i

  const uniqueMessage =
    'may only contain letters, numbers, hyphens, and forward slashes ' +
    '(but cannot start or end with a hyphen or forward slash)'

  const keyError =
    'A component on this form has an invalid or missing API key. Keys must only contain alphanumeric ' +
    "characters or hyphens, and must start with a letter. Please check each component's API Property Name."

  const shortcutError =
    'A component on this form has an invalid shortcut. Shortcuts must only contain alphabetic ' +
    "characters or must be equal to 'Enter' or 'Esc'"

  let msg = 'Component keys must be unique: '

  let shortcutMsg = 'Component shortcuts must be unique: '

  const m = baseModel({
    schema: new Schema({
      title: {
        type: String,
        description: 'The title for the form.',
        required: true
      },
      name: {
        type: String,
        description: 'The machine name for this form.',
        required: true,
        validate: [
          {
            message: `The Name ${uniqueMessage}`,
            validator: (value: string): boolean => !invalidRegex.test(value)
          }
        ]
      },
      path: {
        type: String,
        description: 'The path for this resource.',
        index: true,
        required: true,
        lowercase: true,
        trim: true,
        validate: [
          {
            message: `The Path ${uniqueMessage}`,
            validator: (value: string) => !invalidRegex.test(value)
          },
          {
            message: 'Path cannot end in `submission` or `action`',
            validator: (path: string) => !path.match(/(submission|action)\/?$/)
          }
        ]
      },
      type: {
        type: String,
        enum: ['form', 'resource'],
        required: true,
        default: 'form',
        description: 'The form type.',
        index: true
      },
      display: {
        type: String,
        description: 'The display method for this form'
      },
      action: {
        type: String,
        description: 'A custom action URL to submit the data to.'
      },
      tags: {
        type: [String],
        index: true
      },
      deleted: {
        type: Number,
        default: null
      },
      access: [PermissionSchema],
      submissionAccess: [PermissionSchema],
      owner: {
        type: Schema.Types.Mixed,
        ref: 'submission',
        index: true,
        default: null,
        set: (owner: string) => util.ObjectId(owner),
        get: (owner: string) => (owner ? owner.toString() : owner)
      },
      components: {
        type: [Schema.Types.Mixed],
        description: 'An array of components within the form.',
        validate: [
          {
            message: keyError,
            validator: (components: any[]) =>
              componentKeys(components).every((key: string) =>
                key.match(validKeyRegex)
              )
          },
          {
            message: shortcutError,
            validator: (components: any[]) =>
              componentShortcuts(components).every((shortcut: string) =>
                shortcut.match(validShortcutRegex)
              )
          },
          {
            message: msg,
            validator: (components: any[]) => {
              const paths = componentPaths(components)

              const uniq = paths.uniq()
              const diff = _.difference(paths, uniq)

              if (diff.length === 0) {
                return true
              }
              msg += diff.value().join(', ')
              return false
            }
          },
          {
            message: shortcutMsg,
            validator: (components: any[]) => {
              const shortcuts = componentShortcuts(components)

              const uniq = shortcuts.uniq()
              const diff = shortcuts.filter(
                (value: any, index: number, collection: any) =>
                  _.includes(collection, value, index + 1)
              )

              if (_.isEqual(shortcuts.value(), uniq.value())) {
                return true
              }
              shortcutMsg += diff.value().join(', ')
              return false
            }
          }
        ]
      },
      settings: {
        type: Schema.Types.Mixed,
        description: 'Custom form settings object.'
      },
      properties: {
        type: Schema.Types.Mixed,
        description: 'Custom form properties.'
      }
    })
  })

  return m
}

const FormModel: Model<IForm> = model('form', ModelDefinition().schema)

export default FormModel

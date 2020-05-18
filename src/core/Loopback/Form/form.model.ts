import { Entity, model, property } from '@loopback/repository'
import { Id } from '../../../Helpers/Id'
import { Access } from './dto/Access-dtp.model'

@model({
  settings: {
    strictObjectIDCoercion: true
  }
})
export class Form extends Entity {
  @property({
    default: () => Id.objectID(),
    id: true,
    mongodb: { dataType: 'ObjectID' },
    type: 'string'
  })
  // tslint:disable-next-line: variable-name
  public _id: string

  @property({
    type: 'string'
  })
  public type?: string

  @property.array(String)
  public tags?: string[]

  @property({
    type: 'string'
  })
  public title?: string

  @property({
    type: 'string'
  })
  public display?: string

  @property({
    type: 'string'
  })
  public action?: string

  @property({
    type: 'string'
  })
  public owner: string

  @property({
    type: 'number'
  })
  public settings: number

  @property({
    type: 'number'
  })
  public properties: number

  @property({
    index: {
      unique: true
    },
    type: 'string'
  })
  public name?: string

  @property({
    index: {
      unique: true
    },
    type: 'string',
    unique: true
  })
  public path: string

  @property({
    type: 'string'
  })
  public machineName: string

  @property({
    type: 'string'
  })
  public created: string

  @property({
    type: 'number'
  })
  public deleted?: number

  @property({
    type: 'string'
  })
  public modified: string

  @property.array(Access)
  public access?: Access[]

  @property.array(Access)
  public submissionAccess?: Access[]

  @property({
    type: 'string'
  })
  public components?: string

  constructor(data?: Partial<Form>) {
    super(data)
  }
}

export interface FormRelations {
  // describe navigational properties here
}

export type FormWithRelations = Form & FormRelations

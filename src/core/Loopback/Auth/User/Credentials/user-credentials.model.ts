import { Entity, model, property } from '@loopback/repository'
import { Id } from '../../../../../Helpers/Id'

@model({
  settings: {
    mongodb: {
      collection: 'credentials'
    },
    strictObjectIDCoercion: true
  }
})
export class UserCredentials extends Entity {
  @property({
    default: () => Id.objectID(),
    id: true,
    type: 'string'
  })
  public _id: string

  @property({
    required: true,
    type: 'string'
  })
  public password: string

  @property({
    required: true,
    type: 'string'
  })
  public userId: string

  constructor(data?: Partial<UserCredentials>) {
    super(data)
  }
}

export interface UserCredentialsRelations {
  // describe navigational properties here
}

export type UserCredentialsWithRelations = UserCredentials & UserCredentialsRelations

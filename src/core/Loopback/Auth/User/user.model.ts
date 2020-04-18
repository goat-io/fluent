import { Entity, hasMany, hasOne, model, property } from '@loopback/repository'
import { Id } from '../../../../Helpers/Id'
import { Role } from '../Role/role.model'
import { UserCredentials } from './Credentials/user-credentials.model'
import { UserRoleModel } from './Role/user-role.model'

@model({
  settings: {
    mongodb: {
      collection: 'user'
    },
    indexes: {
      uniqueEmail: {
        keys: {
          email: 1
        },
        options: {
          unique: true
        }
      }
    },
    strictObjectIDCoercion: true
  }
})
export class User extends Entity {
  @property({
    default: () => Id.objectID(),
    id: true,
    type: 'string'
  })
  _id: string

  @property({
    index: {
      unique: true
    },
    required: true,
    type: 'string'
  })
  public email: string

  @property({
    type: 'string'
  })
  public firstName?: string

  @property({
    type: 'string'
  })
  public lastName?: string

  @property({
    index: {
      unique: true
    },
    required: false,
    type: 'string'
  })
  public externalId?: string

  @hasMany(() => UserRoleModel, { keyTo: 'userId' })
  public userRoles?: UserRoleModel[]

  @hasOne(() => UserCredentials)
  public userCredentials: UserCredentials

  constructor(data?: Partial<User>) {
    super(data)
  }
}

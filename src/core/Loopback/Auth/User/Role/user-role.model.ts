import { belongsTo, Entity, model, property } from '@loopback/repository'
import { Id } from '../../../../../Helpers/Id'
import { Role } from '../../Role/role.model'
import { User } from '../user.model'

@model({
  settings: {
    mongodb: {
      collection: 'user_role'
    },
    strictObjectIDCoercion: true
  }
})
export class UserRoleModel extends Entity {
  @property({
    default: () => Id.objectID(),
    id: true,
    type: 'string'
  })
  public _id: string

  @belongsTo(() => User)
  public userId: string

  @belongsTo(() => Role, { name: 'role' })
  public roleId: string

  constructor(data?: Partial<UserRoleModel>) {
    super(data)
  }
}

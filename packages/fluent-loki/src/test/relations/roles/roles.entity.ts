import { Decorators } from '@goatlab/fluent'
import { UsersEntity } from '../user/user.entity'

@Decorators.entity('roles')
export class RoleEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.belongsToMany({
    entity: () => UsersEntity,
    joinTableName: 'roles_users',
    foreignKey: 'roleId',
    inverseForeignKey: 'userId'
  })
  users?: UsersEntity[]
}

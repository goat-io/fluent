import { f } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
@f.entity('roles')
export class RoleEntity {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.belongsToMany({
    entity: () => UsersEntity,
    joinTableName: 'roles_users',
    foreignKey: 'roleId',
    inverseForeignKey: 'userId'
  })
  users?: UsersEntity[]
}

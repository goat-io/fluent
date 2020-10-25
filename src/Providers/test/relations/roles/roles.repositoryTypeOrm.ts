import { RoleEntity } from '../roles/roles.entity'
import { RoleEntityIn } from '../roles/role.dto'
import { RoleUsersRepository } from './roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'

export class RoleRepository extends TypeOrmConnector<RoleEntity, RoleEntityIn> {
  constructor(relations?: any) {
    super(RoleEntity, relations, 'runningTest')
  }

  public users = () => {
    return this.belongsToMany<UserRepository, RoleUsersRepository>(
      UserRepository,
      RoleUsersRepository,
      'users'
    )
  }
}

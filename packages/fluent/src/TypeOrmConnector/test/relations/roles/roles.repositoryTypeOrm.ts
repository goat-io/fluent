import { RoleEntity } from './roles.entity'
import { RoleEntityIn } from './role.dto'
import { RoleUsersRepository } from './roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../memoryDataSource'

export class RoleRepository extends TypeOrmConnector<RoleEntity, RoleEntityIn> {
  constructor(relations?: any) {
    super(RoleEntity, MemoryDataSource, relations)
  }

  public users = () =>
    this.belongsToMany<UserRepository, RoleUsersRepository>(
      UserRepository,
      RoleUsersRepository,
      'users'
    )
}

import { RoleEntity, RoleEntitySchema } from './roles.entity'
import { RoleEntityIn } from './role.dto'
import { RoleUsersRepository } from './roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

export class RoleRepository extends TypeOrmConnector<RoleEntity, RoleEntityIn> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MemoryDataSource,
      inputSchema: RoleEntitySchema
    })
  }

  public users = () =>
    this.belongsToMany({
      repository: UserRepository,
      pivot: RoleUsersRepository
    })
}

import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { RoleDtoOut, RoleOuputSchema } from './role.output.schema'
import { RoleDtoInput, RoleInputSchema } from './role.schema'
import { RoleEntity } from './roles.entity'
import { RoleUsersRepository } from './roles_users.repositoryTypeOrm'

export class RoleRepository extends TypeOrmConnector<
  RoleEntity,
  RoleDtoInput,
  RoleDtoOut
> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MemoryDataSource,
      inputSchema: RoleInputSchema,
      outputSchema: RoleOuputSchema,
    })
  }

  public users = () =>
    this.belongsToMany({
      repository: UserRepository,
      pivot: RoleUsersRepository,
    })
}

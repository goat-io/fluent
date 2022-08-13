import { RoleEntity } from './roles.entity'
import { RoleDtoInput, RoleInputSchema } from './role.schema'
import { RoleUsersRepository } from './roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { RoleOuputSchema, RoleDtoOut } from './role.output.schema'

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
      outputSchema: RoleOuputSchema
    })
  }

  public users = () =>
    this.belongsToMany({
      repository: UserRepository,
      pivot: RoleUsersRepository
    })
}

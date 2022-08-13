import { TypeOrmConnector } from '../../TypeOrmConnector'
import { RoleDtoInput, RoleInputSchema } from '../relations/roles/role.schema'
import { RoleEntity } from '../relations/roles/roles.entity'
import { MYSQLDataSource } from './mysqlDataSource'
import { UserRepository } from './user.mysql.repository'
import { RoleUsersRepository } from './roles_user.mysql.repository'
import {
  RoleDtoOut,
  RoleOuputSchema
} from '../relations/roles/role.output.schema'

export class RoleRepository extends TypeOrmConnector<
  RoleEntity,
  RoleDtoInput,
  RoleDtoOut
> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MYSQLDataSource,
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

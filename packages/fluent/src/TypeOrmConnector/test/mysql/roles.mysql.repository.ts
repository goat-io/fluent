import { TypeOrmConnector } from '../../TypeOrmConnector'
import {
  RoleDtoOut,
  RoleOuputSchema
} from '../relations/roles/role.output.schema'
import { RoleDtoInput, RoleInputSchema } from '../relations/roles/role.schema'
import { RoleEntity } from '../relations/roles/roles.entity'
import { MYSQLDataSource } from './mysqlDataSource'
import { RoleUsersRepository } from './roles_user.mysql.repository'
import { UserRepository } from './user.mysql.repository'

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

import { TypeOrmConnector } from '../../TypeOrmConnector'
import { RoleEntityIn } from '../relations/roles/role.dto'
import { RoleEntity, RoleEntitySchema } from '../relations/roles/roles.entity'
import { MYSQLDataSource } from './mysqlDataSource'

export class RoleRepository extends TypeOrmConnector<RoleEntity, RoleEntityIn> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MYSQLDataSource,
      inputSchema: RoleEntitySchema
    })
  }

  // public users = () =>
  //   this.belongsToMany<UserRepository, RoleUsersRepository>(
  //     UserRepository,
  //     RoleUsersRepository,
  //     'users'
  //   )
}

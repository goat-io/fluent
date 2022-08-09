import { TypeOrmConnector } from '../../TypeOrmConnector'
import {
  RoleEntityInputSchema,
  RoleEntitySchema
} from '../relations/roles/role.schema'
import { RoleEntity } from '../relations/roles/roles.entity'
import { MYSQLDataSource } from './mysqlDataSource'
import { UserRepository } from './user.mysql.repository'
import {RoleUsersRepository} from './roles_user.mysql.repository'

export class RoleRepository extends TypeOrmConnector<
  RoleEntity,
  RoleEntityInputSchema
> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MYSQLDataSource,
      inputSchema: RoleEntitySchema
    })
  }

  public users = () =>
  this.belongsToMany({
    repository: UserRepository,
    pivot: RoleUsersRepository
  })
}

import { TypeOrmConnector } from '../../TypeOrmConnector'
import {
  RoleEntityInputSchema,
  RoleEntitySchema
} from '../relations/roles/role.schema'
import { RoleUsersRepository } from './roles_user.mongo.repository'
import { RoleEntity } from '../relations/roles/roles.entity'
import { MongoDataSource } from './mongoDatasource'
import { UserRepository } from './user.mongo.repository'

export class RoleRepository extends TypeOrmConnector<
  RoleEntity,
  RoleEntityInputSchema
> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MongoDataSource,
      inputSchema: RoleEntitySchema
    })
  }

  public users = () =>
    this.belongsToMany({
      repository: UserRepository,
      pivot: RoleUsersRepository
    })
}

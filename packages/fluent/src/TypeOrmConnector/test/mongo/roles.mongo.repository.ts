import { TypeOrmConnector } from '../../TypeOrmConnector'
import { RoleDtoInput, RoleInputSchema } from '../relations/roles/role.schema'
import { RoleUsersRepository } from './roles_user.mongo.repository'
import { RoleEntity } from '../relations/roles/roles.entity'
import { MongoDataSource } from './mongoDatasource'
import { UserRepository } from './user.mongo.repository'
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
      dataSource: MongoDataSource,
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

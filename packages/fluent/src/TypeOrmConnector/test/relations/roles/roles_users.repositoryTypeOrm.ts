import { RolesUser } from './roles_user.entity'
import { RolesUserInputSchema, RolesUserSchema } from './roles_user.schema'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RolesUserInputSchema
> {
  constructor() {
    super({
      entity: RolesUser,
      dataSource: MemoryDataSource,
      inputSchema: RolesUserSchema
    })
  }
}

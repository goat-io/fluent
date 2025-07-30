import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { RolesUser } from './roles_user.entity'
import { RolesUserInputSchema, RolesUserSchema } from './roles_user.schema'

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

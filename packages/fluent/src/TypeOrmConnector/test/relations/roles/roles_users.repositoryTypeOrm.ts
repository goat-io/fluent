import { RoleUserEntityIn } from './roles_user.dto'
import {
  RolesUser,
  RolesUserInputSchema,
  RolesUserSchema
} from './roles_user.entity'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RoleUserEntityIn,
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

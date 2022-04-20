import { RoleUserEntityIn } from './roles_user.dto'
import { RolesUser } from './roles_user.entity'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../memoryDataSource'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RoleUserEntityIn
> {
  constructor(relations?: any) {
    super(RolesUser, MemoryDataSource, relations)
  }
}

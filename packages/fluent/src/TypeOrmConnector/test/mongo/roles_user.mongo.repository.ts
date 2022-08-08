import { RolesUser } from '../relations/roles/roles_user.entity'
import {
  RolesUserInputSchema,
  RolesUserSchema
} from '../relations/roles/roles_user.schema'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { MongoDataSource } from './mongoDatasource'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RolesUserInputSchema
> {
  constructor() {
    super({
      entity: RolesUser,
      dataSource: MongoDataSource,
      inputSchema: RolesUserSchema
    })
  }
}

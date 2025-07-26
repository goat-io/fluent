import { DataSource } from 'typeorm'
import { RolesUser } from '../relations/roles/roles_user.entity'
import {
  RolesUserInputSchema,
  RolesUserSchema
} from '../relations/roles/roles_user.schema'
import { TypeOrmConnector } from '../../TypeOrmConnector'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RolesUserInputSchema
> {
  constructor(dataSource?: DataSource | (() => DataSource)) {
    super({
      entity: RolesUser,
      dataSource: dataSource || (() => {
        throw new Error('DataSource not provided to RoleUsersRepository')
      }),
      inputSchema: RolesUserSchema
    })
  }
}

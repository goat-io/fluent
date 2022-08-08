import {
  RoleEntitySchema,
  RoleEntityInputSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/role.schema'
import { RoleEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles.entity'
import { FirebaseConnector } from '../FirebaseConnector'

export class RoleRepository extends FirebaseConnector<
  RoleEntity,
  RoleEntityInputSchema
> {
  constructor() {
    super({
      entity: RoleEntity,
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

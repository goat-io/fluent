import { RoleEntityIn } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/role.dto'
import {
  RoleEntity,
  RoleEntitySchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles.entity'
import { FirebaseConnector } from '../FirebaseConnector'

export class RoleRepository extends FirebaseConnector<
  RoleEntity,
  RoleEntityIn
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

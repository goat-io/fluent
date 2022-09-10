import {
  RoleInputSchema,
  RoleDtoInput
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/role.schema'
import { RoleEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles.entity'
import { FirebaseConnector } from '../FirebaseConnector'
import { RoleUsersRepository } from './roles_user.repository'
import { UserRepository } from './user.repository'

export class RoleRepository extends FirebaseConnector<
  RoleEntity,
  RoleDtoInput
> {
  constructor() {
    super({
      entity: RoleEntity,
      inputSchema: RoleInputSchema
    })
  }

  public users = () =>
    this.belongsToMany({
      repository: UserRepository,
      pivot: RoleUsersRepository
    })
}

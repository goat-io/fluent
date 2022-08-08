import { FirebaseConnector } from '../FirebaseConnector'
import { RolesUser } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles_user.entity'
import {
  RolesUserInputSchema,
  RolesUserSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles_user.schema'

export class RoleUsersRepository extends FirebaseConnector<
  RolesUser,
  RolesUserInputSchema
> {
  constructor() {
    super({
      entity: RolesUser,
      inputSchema: RolesUserSchema
    })
  }
}

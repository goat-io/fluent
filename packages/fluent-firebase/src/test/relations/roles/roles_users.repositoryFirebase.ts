import { FirebaseConnector } from '../../../FirebaseConnector'
import { RoleUserEntityIn } from './roles_user.dto'
import { RolesUser } from './roles_user.entity'

export class RoleUsersRepository extends FirebaseConnector<
  RolesUser,
  RoleUserEntityIn
> {
  constructor(relations?: any) {
    super(RolesUser, relations)
  }
}

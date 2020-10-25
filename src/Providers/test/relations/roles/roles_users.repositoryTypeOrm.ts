import { RoleUserEntityIn } from '../roles/roles_user.dto'
import { RolesUser } from '../roles/roles_user.entity'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RoleUserEntityIn
> {
  constructor(relations?: any) {
    super(RolesUser, relations, 'runningTest')
  }
}

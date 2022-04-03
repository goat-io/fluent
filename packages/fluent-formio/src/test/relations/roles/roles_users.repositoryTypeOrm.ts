import { RoleUserEntityIn } from './roles_user.dto'
import { RolesUser } from './roles_user.entity'
import { TypeOrmConnector } from '@goatlab/fluent'

export class RoleUsersRepository extends TypeOrmConnector<
  RolesUser,
  RoleUserEntityIn
> {
  constructor(relations?: any) {
    super(RolesUser, relations, 'runningTest')
  }
}

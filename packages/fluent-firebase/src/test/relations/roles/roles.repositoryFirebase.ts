import { FirebaseConnector } from '../../../FirebaseConnector'
import { RoleEntity } from './roles.entity'
import { RoleEntityIn } from './role.dto'
import { RoleUsersRepository } from './roles_users.repositoryFirebase'
import { UserRepository } from '../user/user.repositoryFirebase'

export class RoleRepository extends FirebaseConnector<
  RoleEntity,
  RoleEntityIn
> {
  constructor(relations?: any) {
    super(RoleEntity, relations)
  }

  public users = () =>
    this.belongsToMany<UserRepository, RoleUsersRepository>(
      UserRepository,
      RoleUsersRepository,
      'users'
    )
}

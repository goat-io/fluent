import { CarsRepository } from '../car/car.repositoryFirebase'
import { FirebaseConnector } from '../../../FirebaseConnector'
import { RoleRepository } from '../roles/roles.repositoryFirebase'
import { RoleUsersRepository } from '../roles/roles_users.repositoryFirebase'
import { UsersEntity } from './user.entity'
import { UsersEntityIn } from './user.dto'

export class UserRepository extends FirebaseConnector<
  UsersEntity,
  UsersEntityIn
> {
  constructor(relations?: any) {
    super(UsersEntity, relations)
  }

  public cars = () => this.hasMany<CarsRepository>(CarsRepository, 'cars')

  public roles = () =>
    this.belongsToMany<RoleRepository, RoleUsersRepository>(
      RoleRepository,
      RoleUsersRepository,
      'roles'
    )
}

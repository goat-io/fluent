import { CarsRepository } from '../car/car.repository'
import { FirebaseConnector } from '../../../../Providers/Firebase/FirebaseConnector'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RolesUser } from '../roles/roles_user.entity'
import { UsersEntity } from './user.entity'
import { UsersEntityIn } from './user.dto'

export class UserRepository extends FirebaseConnector<
  UsersEntity,
  UsersEntityIn
> {
  constructor(relations?: any) {
    super(UsersEntity, relations)
  }

  public cars = () => {
    return this.hasMany<CarsRepository>(CarsRepository, 'cars')
  }

  public roles = () => {
    return this.belongsToMany<RoleRepository, RolesUser>(
      RoleRepository,
      RolesUser,
      'roles'
    )
  }
}

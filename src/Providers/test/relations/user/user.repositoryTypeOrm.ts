import { CarsRepository } from '../car/car.repositoryTypeOrm'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RoleUsersRepository } from '../roles/roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'
import { UsersEntity } from './user.entity'
import { UsersEntityIn } from './user.dto'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityIn
> {
  constructor(relations?: any) {
    super(UsersEntity, relations, 'runningTest')
  }

  public cars = () => {
    return this.hasMany<CarsRepository>(CarsRepository, 'cars')
  }

  public roles = () => {
    return this.belongsToMany<RoleRepository, RoleUsersRepository>(
      RoleRepository,
      RoleUsersRepository,
      'roles'
    )
  }
}

import { CarsRepository } from '../car/car.repositoryTypeOrm'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RoleUsersRepository } from '../roles/roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import {
  UsersEntity,
  UsersEntityInputSchema,
  UsersEntitySchema
} from './user.entity'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { CarsEntity } from '../car/car.entity'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityInputSchema
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MemoryDataSource,
      inputSchema: UsersEntitySchema
    })
  }

  public cars = () => {
    return this.hasMany({
      repository: CarsRepository,
      model: CarsEntity,
      relationKey: { user: true }
    })
  }

  // public roles = () =>
  //   this.belongsToMany<RoleRepository, RoleUsersRepository>(
  //     RoleRepository,
  //     RoleUsersRepository,
  //     'roles'
  //   )
}

import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { CarsRepository } from '../car/car.repositoryTypeOrm'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RoleUsersRepository } from '../roles/roles_users.repositoryTypeOrm'
import { UsersEntity } from './user.entity'
import {
  UsersDtoIn,
  UsersDtoOut,
  userInputSchema,
  userOutputSchema
} from './user.schema'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersDtoIn,
  UsersDtoOut
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MemoryDataSource,
      inputSchema: userInputSchema,
      outputSchema: userOutputSchema
    })
  }

  public cars = () => {
    return this.hasMany({
      repository: CarsRepository
    })
  }

  public roles = () =>
    this.belongsToMany({
      repository: RoleRepository,
      pivot: RoleUsersRepository
    })
}

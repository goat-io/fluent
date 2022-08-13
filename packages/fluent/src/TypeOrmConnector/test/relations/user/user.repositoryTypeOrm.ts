import { CarsRepository } from '../car/car.repositoryTypeOrm'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RoleUsersRepository } from '../roles/roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UsersEntity } from './user.entity'
import {
  userInputSchema,
  UsersDtoIn,
  UsersDtoOut,
  userOutputSchema
} from './user.schema'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

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

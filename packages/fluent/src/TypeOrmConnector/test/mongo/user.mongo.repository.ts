import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import { UsersEntity } from '../relations/user/user.entity'
import {
  userInputSchema,
  userOutputSchema,
  UsersDtoIn,
  UsersDtoOut
} from '../relations/user/user.schema'
import { CarsRepository } from './car.mongo.repository'
import { MongoDataSource } from './mongoDatasource'
import { RoleRepository } from './roles.mongo.repository'
import { RoleUsersRepository } from './roles_user.mongo.repository'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersDtoIn,
  UsersDtoOut
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MongoDataSource,
      inputSchema: userInputSchema,
      outputSchema: userOutputSchema
    })
  }

  public cars = () => {
    return this.hasMany({
      repository: CarsRepository,
      model: CarsEntity
    })
  }

  public roles = () =>
    this.belongsToMany({
      repository: RoleRepository,
      pivot: RoleUsersRepository
    })
}

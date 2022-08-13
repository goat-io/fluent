import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import { UsersEntity } from '../relations/user/user.entity'
import {
  userInputSchema,
  userOutputSchema,
  UsersDtoIn,
  UsersDtoOut
} from '../relations/user/user.schema'
import { CarsRepository } from './car.mysql.repository'
import { MYSQLDataSource } from './mysqlDataSource'
import { RoleRepository } from './roles.mysql.repository'
import { RoleUsersRepository } from './roles_user.mysql.repository'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersDtoIn,
  UsersDtoOut
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MYSQLDataSource,
      inputSchema: userInputSchema,
      outputSchema: userOutputSchema
    })
  }

  public cars = () => {
    return this.hasMany({
      repository: CarsRepository,
      model: CarsEntity,
      relationKey: { user: true }
    })
  }

  public roles = () =>
    this.belongsToMany({
      repository: RoleRepository,
      pivot: RoleUsersRepository
    })
}

import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import { UsersEntity } from '../relations/user/user.entity'
import {
  UsersEntityInputSchema,
  UsersEntitySchema
} from '../relations/user/user.schema'
import { CarsRepository } from './car.mysql.repository'
import { MYSQLDataSource } from './mysqlDataSource'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityInputSchema
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MYSQLDataSource,
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

import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import { UsersEntity } from '../relations/user/user.entity'
import {
  UsersDtoIn,
  UsersDtoOut,
  userInputSchema,
  userOutputSchema,
} from '../relations/user/user.schema'
import { CarsRepository } from './car.mongo.repository'
import { RoleRepository } from './roles.mongo.repository'
import { RoleUsersRepository } from './roles_user.mongo.repository'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersDtoIn,
  UsersDtoOut
> {
  private dataSourceRef: DataSource | (() => DataSource)

  constructor(dataSource?: DataSource | (() => DataSource)) {
    const ds =
      dataSource ||
      (() => {
        throw new Error('DataSource not provided to UserRepository')
      })
    super({
      entity: UsersEntity,
      dataSource: ds,
      inputSchema: userInputSchema,
      outputSchema: userOutputSchema,
    })
    this.dataSourceRef = ds
  }

  public cars = () => {
    return this.hasMany({
      repository: () => new CarsRepository(this.dataSourceRef),
      model: CarsEntity,
    })
  }

  public roles = () =>
    this.belongsToMany({
      repository: () => new RoleRepository(this.dataSourceRef),
      pivot: () => new RoleUsersRepository(this.dataSourceRef),
    })
}

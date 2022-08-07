import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import {
  CarsEntityInputSchema,
  CarsEntitySchema
} from '../relations/car/car.schema'
import { UsersEntity } from '../relations/user/user.entity'
import { MongoDataSource } from './mongoDatasource'
import { UserRepository } from './user.mongo.repository'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarsEntityInputSchema
> {
  constructor() {
    super({
      entity: CarsEntity,
      dataSource: MongoDataSource,
      inputSchema: CarsEntitySchema
    })
  }

  public user = () => this.belongsTo({
    repository: UserRepository,
    model: UsersEntity
  })
}

import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import {
  CarsEntityInputSchema,
  CarsEntitySchema
} from '../relations/car/car.schema'
import { MongoDataSource } from './mongoDatasource'

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

  // public user = () => this.belongsTo<UserRepository>(UserRepository, 'user')
}

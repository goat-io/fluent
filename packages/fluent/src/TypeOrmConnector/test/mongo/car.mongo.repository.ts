import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import {
  CarDtoOutput,
  carOutputSchema
} from '../relations/car/car.output.schema'
import { CarDtoInput, carInputSchema } from '../relations/car/car.schema'
import { UsersEntity } from '../relations/user/user.entity'
import { MongoDataSource } from './mongoDatasource'
import { UserRepository } from './user.mongo.repository'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarDtoInput,
  CarDtoOutput
> {
  constructor() {
    super({
      entity: CarsEntity,
      dataSource: MongoDataSource,
      inputSchema: carInputSchema,
      outputSchema: carOutputSchema
    })
  }

  public user = () =>
    this.belongsTo({
      repository: UserRepository,
      model: UsersEntity
    })

  public anotherRelation = () =>
    this.belongsTo({
      repository: UserRepository
    })
}

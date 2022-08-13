import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import {
  CarDtoOutput,
  carOutputSchema
} from '../relations/car/car.output.schema'
import { CarDtoInput, carInputSchema } from '../relations/car/car.schema'
import { MYSQLDataSource } from './mysqlDataSource'
import { UserRepository } from './user.mysql.repository'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarDtoInput,
  CarDtoOutput
> {
  constructor() {
    super({
      entity: CarsEntity,
      dataSource: MYSQLDataSource,
      inputSchema: carInputSchema,
      outputSchema: carOutputSchema
    })
  }

  public user = () =>
    this.belongsTo({
      repository: UserRepository
    })

  public anotherRelation = () =>
    this.belongsTo({
      repository: UserRepository
    })
}

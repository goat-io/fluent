import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { CarsEntity } from '../relations/car/car.entity'
import {
  CarDtoOutput,
  carOutputSchema
} from '../relations/car/car.output.schema'
import { CarDtoInput, carInputSchema } from '../relations/car/car.schema'
import { UsersEntity } from '../relations/user/user.entity'
import { UserRepository } from './user.mongo.repository'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarDtoInput,
  CarDtoOutput
> {
  private dataSourceRef: DataSource | (() => DataSource)
  
  constructor(dataSource?: DataSource | (() => DataSource)) {
    const ds = dataSource || (() => {
      throw new Error('DataSource not provided to CarsRepository')
    })
    super({
      entity: CarsEntity,
      dataSource: ds,
      inputSchema: carInputSchema,
      outputSchema: carOutputSchema
    })
    this.dataSourceRef = ds
  }

  public user = () =>
    this.belongsTo({
      repository: () => new UserRepository(this.dataSourceRef),
      model: UsersEntity
    })

  public anotherRelation = () =>
    this.belongsTo({
      repository: () => new UserRepository(this.dataSourceRef)
    })
}

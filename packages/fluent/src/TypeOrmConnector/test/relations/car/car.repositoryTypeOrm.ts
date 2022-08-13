import { CarsEntity } from './car.entity'
import { carInputSchema, CarDtoInput } from './car.schema'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { CarDtoOutput, carOutputSchema } from './car.output.schema'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarDtoInput,
  CarDtoOutput
> {
  constructor() {
    super({
      entity: CarsEntity,
      dataSource: MemoryDataSource,
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

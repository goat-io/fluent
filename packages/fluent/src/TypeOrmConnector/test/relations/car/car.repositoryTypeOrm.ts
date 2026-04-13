import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { CarsEntity } from './car.entity'
import { CarDtoOutput, carOutputSchema } from './car.output.schema'
import { CarDtoInput, carInputSchema } from './car.schema'

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
      outputSchema: carOutputSchema,
    })
  }

  public user = () =>
    this.belongsTo({
      repository: UserRepository,
    })

  public anotherRelation = () =>
    this.belongsTo({
      repository: UserRepository,
    })
}

import { CarsEntity } from './car.entity'
import { CarsEntitySchema, CarsEntityInputSchema } from './car.schema'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'
import { UsersEntity } from '../user/user.entity'

export class CarsRepository extends TypeOrmConnector<
  CarsEntity,
  CarsEntityInputSchema
> {
  constructor() {
    super({
      entity: CarsEntity,
      dataSource: MemoryDataSource,
      inputSchema: CarsEntitySchema
    })
  }

  public user = () =>
    this.belongsTo({
      repository: UserRepository
    })
}

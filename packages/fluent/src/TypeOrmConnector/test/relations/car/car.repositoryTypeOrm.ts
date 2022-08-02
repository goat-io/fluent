import {
  CarsEntity,
  CarsEntitySchema,
  CarsEntityInputSchema
} from './car.entity'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

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
/*
  public user = () => this.belongsTo<UserRepository>(UserRepository, 'user')
  */
}

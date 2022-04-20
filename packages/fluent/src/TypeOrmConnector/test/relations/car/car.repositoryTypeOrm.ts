import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'
import { MemoryDataSource } from '../../memoryDataSource'

export class CarsRepository extends TypeOrmConnector<CarsEntity, CarsEntityIn> {
  constructor(relationQuery?: any) {
    super(CarsEntity, MemoryDataSource, relationQuery)
  }

  public user = () => this.belongsTo<UserRepository>(UserRepository, 'user')
}

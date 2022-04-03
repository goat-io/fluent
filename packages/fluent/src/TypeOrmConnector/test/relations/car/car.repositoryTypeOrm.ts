import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'

export class CarsRepository extends TypeOrmConnector<CarsEntity, CarsEntityIn> {
  constructor(relationQuery?: any) {
    super(CarsEntity, relationQuery, 'runningTest')
  }

  public user = () => this.belongsTo<UserRepository>(UserRepository, 'user')
}

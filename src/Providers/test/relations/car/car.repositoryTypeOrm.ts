import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'
import { UserRepository } from '../user/user.repositoryTypeOrm'

export class CarsRepository extends TypeOrmConnector<CarsEntity, CarsEntityIn> {
  constructor(relationQuery?: any) {
    super(CarsEntity, 'runningTest', relationQuery)
  }

  public user = () => {
    return this.belongsTo<UserRepository>(UserRepository, 'user')
  }
}
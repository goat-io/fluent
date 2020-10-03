import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { FirebaseConnector } from '../../../../Providers/Firebase/FirebaseConnector'
import { UserRepository } from '../user/user.repository'

export class CarsRepository extends FirebaseConnector<
  CarsEntity,
  CarsEntityIn
> {
  constructor(relationQuery?: any) {
    super(CarsEntity, relationQuery)
  }

  public user = () => {
    return this.belongsTo<UserRepository>(UserRepository, 'user')
  }
}

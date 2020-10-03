import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { FirebaseConnector } from '../../../Firebase/FirebaseConnector'
import { UserRepository } from '../user/user.repositoryFirebase'

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

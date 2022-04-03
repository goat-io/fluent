import { CarsEntity } from './car.entity'
import { CarsEntityIn } from './car.dto'
import { FirebaseConnector } from '../../../FirebaseConnector'
import { UserRepository } from '../user/user.repositoryFirebase'

export class CarsRepository extends FirebaseConnector<
  CarsEntity,
  CarsEntityIn
> {
  constructor(relationQuery?: any) {
    super(CarsEntity, relationQuery)
  }

  public user = () => this.belongsTo<UserRepository>(UserRepository, 'user')
}

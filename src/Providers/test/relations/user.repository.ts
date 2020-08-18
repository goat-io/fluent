import { CarsRepository } from './car.repository'
import { FirebaseConnector } from '../../../Providers/Firebase/FirebaseConnector'
import { UsersEntity } from './user.entity'
import { UsersEntityIn } from './user.dto'

export class UserRepository extends FirebaseConnector<
  UsersEntity,
  UsersEntityIn
> {
  constructor(relations?: any) {
    super(UsersEntity, relations)
  }

  public cars = () => {
    return this.hasMany<CarsRepository>(
      new CarsRepository(this.relationQuery),
      'cars'
    )
  }
}

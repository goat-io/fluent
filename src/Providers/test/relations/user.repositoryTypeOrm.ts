import { CarsRepository } from './car.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../Providers/TypeOrm/TypeOrmConnector'
import { UsersEntity } from './user.entity'
import { UsersEntityIn } from './user.dto'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityIn
> {
  constructor(relations?: any) {
    super(UsersEntity, 'runningTest', relations)
  }

  public cars = () => {
    return this.hasMany<CarsRepository>(
      new CarsRepository(this.relationQuery),
      'cars'
    )
  }
}

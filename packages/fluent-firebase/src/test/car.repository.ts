import { CarsEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/car/car.entity'
import {
  CarDtoInput,
  carInputSchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/car/car.schema'
import { FirebaseConnector } from '../FirebaseConnector'
import { UserRepository } from './user.repository'
import { UsersEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/user/user.entity'

export class CarsRepository extends FirebaseConnector<
  CarsEntity,
  CarDtoInput
> {
  constructor() {
    super({
      entity: CarsEntity,
      inputSchema: carInputSchema
    })
  }

  public user = () =>
    this.belongsTo({
      repository: UserRepository,
      model: UsersEntity,
    })
}

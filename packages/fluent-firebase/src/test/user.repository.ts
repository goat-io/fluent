import { CarsEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/car/car.entity'
import { UsersEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/user/user.entity'
import {
  UsersEntityInputSchema,
  UsersEntitySchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/user/user.schema'
import { CarsRepository } from './car.repository'
import { FirebaseConnector } from '../FirebaseConnector'
import { RoleRepository } from './roles.repository'
import { RoleUsersRepository } from './roles_user.repository'

export class UserRepository extends FirebaseConnector<
  UsersEntity,
  UsersEntityInputSchema
> {
  constructor() {
    super({
      entity: UsersEntity,
      inputSchema: UsersEntitySchema
    })
  }

  public cars = () => {
    return this.hasMany({
      repository: CarsRepository,
      model: CarsEntity
    })
  }

  public roles = () =>
    this.belongsToMany({
      repository: RoleRepository,
      pivot: RoleUsersRepository
    })
}

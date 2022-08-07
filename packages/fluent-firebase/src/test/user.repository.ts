import { CarsEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/car/car.entity'
import { UsersEntity } from '@goatlab/fluent/src/TypeOrmConnector/test/relations/user/user.entity'
import {
  UsersEntityInputSchema,
  UsersEntitySchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/user/user.schema'
import { CarsRepository } from './car.repository'
import {
  RoleEntity,
  RoleEntitySchema
} from '@goatlab/fluent/src/TypeOrmConnector/test/relations/roles/roles.entity'
import { FirebaseConnector } from '../FirebaseConnector'

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
  // public roles = () =>
  //   this.belongsToMany<RoleRepository, RoleUsersRepository>(
  //     RoleRepository,
  //     RoleUsersRepository,
  //     'roles'
  //   )
}

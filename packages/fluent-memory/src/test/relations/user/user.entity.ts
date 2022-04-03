import { CarsEntity } from '../car/car.entity'
import { Decorators } from '@goatlab/fluent'
import { RoleEntity } from '../roles/roles.entity'

export class Family {
  @Decorators.property({ required: false })
  family?: string

  @Decorators.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@Decorators.entity('users')
export class UsersEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: false })
  age?: number

  @Decorators.embed(Family)
  breed?: Family

  @Decorators.hasMany({
    entity: () => CarsEntity,
    inverse: cars => cars.userId
  })
  cars?: CarsEntity[]

  @Decorators.belongsToMany({
    entity: () => RoleEntity,
    joinTableName: 'roles_users',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles?: RoleEntity[]
}

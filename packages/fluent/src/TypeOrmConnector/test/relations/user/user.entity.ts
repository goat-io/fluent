import { CarsEntity } from '../car/car.entity'
import { f } from '../../../../decorators'
import { RoleEntity } from '../roles/roles.entity'
import { FluentEntity } from '../../../../FluentEntity'

export class Family {
  @f.property({ required: false })
  family?: string

  @f.property({ required: false })
  members?: number
}

@f.entity('users')
export class UsersEntity {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: false })
  age?: number

  @f.embed(Family)
  breed?: Family

  @f.hasMany({
    entity: () => CarsEntity,
    inverse: cars => cars.user
  })
  cars?: CarsEntity[]

  @f.belongsToMany({
    entity: () => RoleEntity,
    joinTableName: 'roles_users',
    foreignKey: 'userId',
    inverseForeignKey: 'roleId'
  })
  roles?: RoleEntity[]
}

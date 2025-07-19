import { TypeORMDataModel } from './advanced/typeOrm.entity'
import { GoatEntity } from './basic/goat.entity'
import { CarsEntity } from './relations/car/car.entity'
import { RoleEntity } from './relations/roles/roles.entity'
import { RolesUser } from './relations/roles/roles_user.entity'
import { UsersEntity } from './relations/user/user.entity'

export const dbEntities = [
  GoatEntity,
  TypeORMDataModel,
  // Commenting out relation entities as they're not used in current tests
  // and cause issues with PostgreSQL constraints
  // CarsEntity,
  // UsersEntity,
  // RoleEntity,
  // RolesUser
]

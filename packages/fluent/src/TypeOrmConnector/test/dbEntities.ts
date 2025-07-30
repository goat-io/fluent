import { TypeORMDataModel } from './advanced/typeOrm.entity'
import { GoatEntity } from './basic/goat.entity'

export const dbEntities = [
  GoatEntity,
  TypeORMDataModel
  // Commenting out relation entities as they're not used in current tests
  // and cause issues with PostgreSQL constraints
  // CarsEntity,
  // UsersEntity,
  // RoleEntity,
  // RolesUser
]

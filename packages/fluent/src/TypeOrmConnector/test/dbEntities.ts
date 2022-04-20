import { TypeORMDataModel } from "./advanced/typeOrm.entity";
import { GoatEntity } from "./basic/goat.entity";
import { CarsEntity } from "./relations/car/car.entity";
import { RoleEntity } from "./relations/roles/roles.entity";
import { RolesUser } from "./relations/roles/roles_user.entity";
import { UsersEntity } from "./relations/user/user.entity";

export const dbEntities = [
    GoatEntity,
    TypeORMDataModel,
    CarsEntity,
    UsersEntity,
    RoleEntity,
    RolesUser
  ]
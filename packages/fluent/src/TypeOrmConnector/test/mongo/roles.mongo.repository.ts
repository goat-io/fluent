import { TypeOrmConnector } from "../../TypeOrmConnector";
import { RoleEntityIn } from "../relations/roles/role.dto";
import { RoleEntity, RoleEntitySchema } from "../relations/roles/roles.entity";
import { MongoDataSource } from "./mongoDatasource";


export class RoleRepository extends TypeOrmConnector<RoleEntity, RoleEntityIn> {
  constructor() {
    super({
      entity: RoleEntity,
      dataSource: MongoDataSource,
      inputSchema: RoleEntitySchema
    })
  }

  // public users = () =>
  //   this.belongsToMany<UserRepository, RoleUsersRepository>(
  //     UserRepository,
  //     RoleUsersRepository,
  //     'users'
  //   )
}

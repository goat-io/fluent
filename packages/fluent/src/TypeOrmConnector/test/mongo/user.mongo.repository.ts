import { TypeOrmConnector } from "../../TypeOrmConnector"
import { CarsEntity } from "../relations/car/car.entity"
import { UsersEntity } from "../relations/user/user.entity"
import { UsersEntityInputSchema, UsersEntitySchema } from "../relations/user/user.schema"
import { CarsRepository } from "./car.mongo.repository"
import { MongoDataSource } from "./mongoDatasource"


export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityInputSchema
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MongoDataSource,
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

import { CarsRepository } from '../car/car.repositoryTypeOrm'
import { RoleRepository } from '../roles/roles.repositoryTypeOrm'
import { RoleUsersRepository } from '../roles/roles_users.repositoryTypeOrm'
import { TypeOrmConnector } from '../../../TypeOrmConnector'
import {
  UsersEntity,
  UsersEntityInputSchema,
  UsersEntitySchema
} from './user.entity'
import { MemoryDataSource } from '../../sqlite/memoryDataSource'

export class UserRepository extends TypeOrmConnector<
  UsersEntity,
  UsersEntityInputSchema
> {
  constructor() {
    super({
      entity: UsersEntity,
      dataSource: MemoryDataSource,
      inputSchema: UsersEntitySchema
    })
  }

  public cars = () =>
    this.hasMany({
      repository: CarsRepository,
      relationKey: { age: true }
    })

  public roles = () =>
    this.belongsToMany<RoleRepository, RoleUsersRepository>(
      RoleRepository,
      RoleUsersRepository,
      'roles'
    )
}

const a = async () => {
  const user = new UserRepository()

  const a = await user
    .loadFirst({
      where: {
        id: '2'
      }
    })
    .cars()
    .attach({ name: 'Another new car' })

  const b = await user.findFirst({
    where: {
      name: 'john'
    }, 
    select: {
      age: true
    }
  })
  
  b?.age
}

// const cars = await user.cars().attach({ name: 'Another new car' })

import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../../TypeOrmConnector'
import { RoleDtoInput, RoleInputSchema } from '../relations/roles/role.schema'
import { RoleUsersRepository } from './roles_user.mongo.repository'
import { RoleEntity } from '../relations/roles/roles.entity'
import { UserRepository } from './user.mongo.repository'
import {
  RoleDtoOut,
  RoleOuputSchema
} from '../relations/roles/role.output.schema'

export class RoleRepository extends TypeOrmConnector<
  RoleEntity,
  RoleDtoInput,
  RoleDtoOut
> {
  private dataSourceRef: DataSource | (() => DataSource)
  
  constructor(dataSource?: DataSource | (() => DataSource)) {
    const ds = dataSource || (() => {
      throw new Error('DataSource not provided to RoleRepository')
    })
    super({
      entity: RoleEntity,
      dataSource: ds,
      inputSchema: RoleInputSchema,
      outputSchema: RoleOuputSchema
    })
    this.dataSourceRef = ds
  }

  public users = () =>
    this.belongsToMany({
      repository: () => new UserRepository(this.dataSourceRef),
      pivot: () => new RoleUsersRepository(this.dataSourceRef)
    })
}

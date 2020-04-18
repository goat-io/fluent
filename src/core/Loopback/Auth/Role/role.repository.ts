import { inject } from '@loopback/core'
import { DefaultCrudRepository, juggler } from '@loopback/repository'
import { Role } from './role.model'

export class RoleRepository extends DefaultCrudRepository<Role, typeof Role.prototype._id> {
  constructor(@inject('datasources.roles') dataSource: juggler.DataSource) {
    super(Role, dataSource)
  }
}

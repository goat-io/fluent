import { Getter, inject } from '@loopback/core'
import { BelongsToAccessor, DefaultCrudRepository, juggler, repository } from '@loopback/repository'
import { Role } from '../../Role/role.model'
import { RoleRepository } from '../../Role/role.repository'
import { UserRoleModel } from './user-role.model'

export class UserRoleRepository extends DefaultCrudRepository<UserRoleModel, typeof UserRoleModel.prototype._id> {
  public readonly role: BelongsToAccessor<Role, typeof Role.prototype._id>
  constructor(
    @inject('datasources.mongo') dataSource: juggler.DataSource,
    @repository.getter('RoleRepository')
    roleRepositoryGetter: Getter<RoleRepository>
  ) {
    super(UserRoleModel, dataSource)
    this.role = this.createBelongsToAccessorFor('role', roleRepositoryGetter)
    this.registerInclusionResolver('role', this.role.inclusionResolver)
  }
}

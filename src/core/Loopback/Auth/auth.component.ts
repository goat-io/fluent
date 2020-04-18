import { inject } from '@loopback/context'
import { Component, CoreBindings } from '@loopback/core'
import { RoleController } from './Role/role.controller'
import { RoleRepository } from './Role/role.repository'
import { RoleDataSource } from './Role/roles.datasource'
import { UserCredentialsRepository } from './User/Credentials/user-credentials.repository'
import { UserRoleController } from './User/Role/user-role.controller'
import { UserRoleRepository } from './User/Role/user-role.repository'
import { UserController } from './User/user.controller'
import { UserRepository } from './User/user.repository'

export class AuthComponent implements Component {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private application: any
  ) {
    // User
    this.application.controller(UserController)
    this.application.repository(UserRepository)
    this.application.repository(UserCredentialsRepository)

    // Role
    this.application.controller(RoleController)
    this.application.dataSource(RoleDataSource)
    this.application.repository(RoleRepository)

    // User-Role
    this.application.repository(UserRoleRepository)
    this.application.controller(UserRoleController)
  }
}

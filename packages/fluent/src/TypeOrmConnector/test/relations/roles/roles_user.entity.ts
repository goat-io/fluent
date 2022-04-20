import { Decorators } from '../../../../decorators'

@Decorators.entity('roles_users')
export class RolesUser {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  userId?: string

  @Decorators.property({ required: false })
  roleId?: string
}

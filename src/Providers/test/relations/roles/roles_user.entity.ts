import { Decorators } from '../../../../core/Nestjs/Database/decorators'

@Decorators.entity('roles_users')
export class RolesUser {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  userId?: string

  @Decorators.property({ required: false })
  roleId?: string
}

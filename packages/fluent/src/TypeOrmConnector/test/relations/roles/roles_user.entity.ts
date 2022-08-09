import { f } from '../../../../decorators'

@f.entity('roles_users')
export class RolesUser {
  @f.id()
  id: string

  @f.property({ required: false })
  userId: string

  @f.property({ required: false })
  roleId: string
}




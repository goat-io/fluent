import { JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm'

import { Decorators } from '../../../../core/Nestjs/Database/decorators'
import { RoleEntity } from './roles.entity'
import { UsersEntity } from '../user/user.entity'

@Decorators.entity('roles_users')
export class RolesUser {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  userId?: string

  @Decorators.property({ required: false })
  roleId?: string

  @ManyToOne(() => RoleEntity, role => role.id)
  @JoinColumn({ name: 'roleId' })
  public role?: RoleEntity

  @ManyToOne(() => UsersEntity, user => user.id)
  @JoinColumn({ name: 'userId' })
  public user?: UsersEntity
}

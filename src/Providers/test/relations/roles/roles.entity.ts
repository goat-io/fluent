import { JoinColumn, JoinTable, ManyToMany, OneToMany } from 'typeorm'

import { Decorators } from '../../../../core/Nestjs/Database/decorators'
import { RolesUser } from './roles_user.entity'
import { UsersEntity } from '../user/user.entity'

@Decorators.entity('roles')
export class RoleEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @ManyToMany(type => UsersEntity, user => user.roles)
  @JoinTable({
    name: 'roles_users',
    joinColumns: [{ name: 'roleId' }],
    inverseJoinColumns: [{ name: 'userId' }]
  })
  users?: UsersEntity[]
}

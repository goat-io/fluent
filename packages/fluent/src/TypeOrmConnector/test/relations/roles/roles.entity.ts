import { Decorators } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
import { z } from 'zod'
@Decorators.entity('roles')
export class RoleEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.belongsToMany({
    entity: () => UsersEntity,
    joinTableName: 'roles_users',
    foreignKey: 'roleId',
    inverseForeignKey: 'userId'
  })
  users?: UsersEntity[]
}

export const RoleEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string()
})

export type RoleEntityInputSchema = z.infer<typeof RoleEntitySchema>

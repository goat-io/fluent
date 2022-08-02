import { f } from '../../../../decorators'
import { UsersEntity } from '../user/user.entity'
import { z } from 'zod'
import { FluentEntity } from '../../../../FluentEntity'
@f.entity('roles')
export class RoleEntity extends FluentEntity{
  @f.property({ required: true })
  name: string

  @f.belongsToMany({
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

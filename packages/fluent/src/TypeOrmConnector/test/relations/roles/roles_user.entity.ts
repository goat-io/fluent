import { f } from '../../../../decorators'
import {z} from 'zod'
import { FluentEntity } from '../../../../FluentEntity'
@f.entity('roles_users')
export class RolesUser extends FluentEntity {
  @f.property({ required: false })
  userId?: string

  @f.property({ required: false })
  roleId?: string
}


export const RolesUserSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  roleId: z.string().optional()
})

export type RolesUserInputSchema = z.infer<typeof RolesUserSchema>

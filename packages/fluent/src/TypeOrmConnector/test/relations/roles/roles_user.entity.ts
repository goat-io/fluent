import { Decorators } from '../../../../decorators'
import {z} from 'zod'
@Decorators.entity('roles_users')
export class RolesUser {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  userId?: string

  @Decorators.property({ required: false })
  roleId?: string
}


export const RolesUserSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  roleId: z.string().optional()
})

export type RolesUserInputSchema = z.infer<typeof RolesUserSchema>

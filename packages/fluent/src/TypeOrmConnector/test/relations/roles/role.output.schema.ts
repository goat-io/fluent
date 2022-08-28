import { z } from 'zod'
import { userInputSchema } from '../user/user.schema'
import { RoleInputSchema } from './role.schema'
import { RolesUserSchema } from './roles_user.schema'


// We need to add 1 by 1 the relations so we can
export const userWithPivot = userInputSchema.extend({
  pivot: RolesUserSchema.optional()
})

export const RoleOuputSchema = RoleInputSchema.extend({
  id: z.string(),
  users: userWithPivot.array().optional()
})

export type RoleDtoOut = z.infer<typeof RoleOuputSchema>

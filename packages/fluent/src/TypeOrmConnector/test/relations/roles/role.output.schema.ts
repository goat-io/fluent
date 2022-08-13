import { z } from 'zod'
import { userInputSchema } from '../user/user.schema'
import { RoleInputSchema } from './role.schema'

export const RoleOuputSchema = RoleInputSchema.extend({
  id: z.string(),
  users: userInputSchema.array().optional()
})

export type RoleDtoOut = z.infer<typeof RoleOuputSchema>

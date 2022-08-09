import { z } from 'zod'

export const RolesUserSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  roleId: z.string()
})

export type RolesUserInputSchema = z.infer<typeof RolesUserSchema>

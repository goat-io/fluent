import { z } from 'zod'

export const RoleInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
})

export type RoleDtoInput = z.infer<typeof RoleInputSchema>
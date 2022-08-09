import { array, z } from 'zod'

export const RoleEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  // We need to manually refine this relation
  users: z
    .object({
      id: z.string().optional(),
      name: z.string(),
      age: z.number().optional()
    })
    .array()
    .optional()
})

export type RoleEntityInputSchema = z.infer<typeof RoleEntitySchema>

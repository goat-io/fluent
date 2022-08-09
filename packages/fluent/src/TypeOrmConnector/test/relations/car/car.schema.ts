import { z } from 'zod'

export const CarsEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  userId: z.string().optional(),
  // We need to manually define this type or we would create a recursion
  user: z.object({
    id: z.string().optional(),
    name: z.string(),
    age: z.number().optional(),
  }).optional()
})

export type CarsEntityInputSchema = z.infer<typeof CarsEntitySchema>

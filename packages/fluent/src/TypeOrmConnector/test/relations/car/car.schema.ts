import { z } from 'zod'

export const carInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  userId: z.string().optional()
})

export type CarDtoInput = z.infer<typeof carInputSchema>


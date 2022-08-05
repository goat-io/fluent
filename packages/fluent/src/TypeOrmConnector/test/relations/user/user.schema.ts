import { z } from 'zod'
import { CarsEntitySchema } from '../car/car.schema'

export const BreedSchema = z.object({
  family: z.string().optional(),
  members: z.number().optional()
})

export const UsersEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().optional(),
  breed: BreedSchema.optional(),
  cars: CarsEntitySchema.array().optional()
})

export type UsersEntityInputSchema = z.infer<typeof UsersEntitySchema>

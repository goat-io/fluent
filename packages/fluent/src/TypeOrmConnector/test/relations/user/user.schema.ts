import { z } from 'zod'
import { carInputSchema } from '../car/car.schema'
import { carOutputSchema } from '../car/car.output.schema'
import { RoleInputSchema } from '../roles/role.schema'

export const BreedSchema = z.object({
  family: z.string().optional(),
  members: z.number().optional()
})

export const userInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().optional(),
  breed: BreedSchema.optional()
})

export const userOutputSchema = userInputSchema.extend({
  id: z.string(),
  cars: carInputSchema
    .extend({
      user: userInputSchema.extend({
        id: z.string(),
        cars: carInputSchema
          .extend({
            user: userInputSchema
          })
          .array()
          .optional(),
        roles: RoleInputSchema.array().optional()
      })
    })
    .array()
    .optional(),
  roles: RoleInputSchema.array().optional()
})

export type UsersDtoIn = z.infer<typeof userInputSchema>

export type UsersDtoOut = z.infer<typeof userOutputSchema>
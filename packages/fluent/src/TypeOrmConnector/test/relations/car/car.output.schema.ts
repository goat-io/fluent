import { userInputSchema, userOutputSchema } from '../user/user.schema'
import { carInputSchema } from './car.schema'
import { z } from 'zod'

export const carOutputSchema = carInputSchema.extend({
  user: userOutputSchema.optional()
})

export type CarDtoOutput = z.infer<typeof carOutputSchema>

import { z } from 'zod'
import { userOutputSchema } from '../user/user.schema'
import { carInputSchema } from './car.schema'

export const carOutputSchema = carInputSchema.extend({
  user: userOutputSchema.optional()
})

export type CarDtoOutput = z.infer<typeof carOutputSchema>

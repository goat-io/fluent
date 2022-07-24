import { ObjectType } from '../../../core/types'
import { Decorators } from '../../../decorators'
import { z } from 'zod'

@ObjectType()
export class Breed {
  @Decorators.property({ required: false })
  family?: string

  @Decorators.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@Decorators.entity('goat')
export class GoatEntity {
  @Decorators.id()
  id: string

  @Decorators.property({ required: true })
  name: string

  @Decorators.property({ required: false })
  age?: number

  @Decorators.embed(Breed)
  breed?: Breed
}

export const BreedSchema = z.object({
  family: z.string(),
  members: z.number()
})

export const GoatSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number(),
  breed: BreedSchema.optional()
})

export type GoatInputSchema = z.infer<typeof GoatSchema>

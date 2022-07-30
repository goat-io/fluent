import { ObjectType } from '../../../core/types'
import { f } from '../../../decorators'
import { z } from 'zod'

@ObjectType()
export class Breed {
  @f.property({ required: false })
  family?: string

  @f.property({ required: false })
  members?: number
}

// tslint:disable-next-line: max-classes-per-file
@f.entity('goat')
export class GoatEntity {
  @f.id()
  id: string

  @f.property({ required: true })
  name: string

  @f.property({ required: false })
  age?: number

  @f.embed(Breed)
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

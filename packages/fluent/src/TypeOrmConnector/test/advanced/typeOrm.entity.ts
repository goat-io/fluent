import { z } from 'zod'
import { Decorators } from '../../../decorators'


export class FurtherNested {
  @Decorators.property({ required: false })
  c: boolean

  @Decorators.stringArray({ required: true })
  d: string[]

  @Decorators.property({ required: false })
  e?: number
}


export class Nested {
  // Array can only be string in SQLite
  @Decorators.stringArray({ required: true })
  a: string[]

  // Non array props of a optional nested object cannot be required
  @Decorators.property({ required: false })
  c: number

  @Decorators.embed(FurtherNested)
  b?: FurtherNested

  @Decorators.property({ required: false })
  e?: number
}

@Decorators.entity('numbers')
export class TypeORMDataModel {
  @Decorators.id()
  id: string

  @Decorators.property({ required: false })
  created?: string

  @Decorators.embed(Nested)
  nestedTest?: Nested | undefined


  @Decorators.embed(Nested)
  nonNullNested: Nested

  @Decorators.property({ required: false })
  order?: number

  @Decorators.property({ required: true })
  test: boolean
}

export const FurtherNestedSchema = z.object({
  c: z.boolean(),
  d: z.string().array(),
  e: z.number().optional()
})

export const NestedSchema = z.object({
  a: z.string().array(),
  c: z.number(),
  b: FurtherNestedSchema.optional(),
  e: z.number().optional()
})

export const TypeORMDataModelSchema = z.object({
  id: z.string().optional(),
  created: z.string().optional(),
  order: z.number().optional(),
  nestedTest: NestedSchema.optional(),
  nonNullNested: NestedSchema,
  test: z.boolean()
})


export type TypeORMDataModelInputSchema = z.infer<typeof TypeORMDataModelSchema>

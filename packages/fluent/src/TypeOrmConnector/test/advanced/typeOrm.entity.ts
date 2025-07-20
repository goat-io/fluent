import { z } from 'zod'
import { f } from '../../../decorators'

export class FurtherNested {
  @f.property({ required: false, type: 'boolean' })
  c: boolean

  @f.stringArray({ required: true })
  d: string[]
}

export class Nested {
  // Array can only be string in SQLite
  @f.stringArray({ required: true })
  a: string[]

  // Non array props of a optional nested object cannot be required
  @f.property({ required: false, type: 'int' })
  c: number

  @f.embed(FurtherNested)
  b?: FurtherNested
}

@f.entity('numbers')
export class TypeORMDataModel {
  @f.id()
  id: string

  @f.created()
  created?: Date

  @f.embed(Nested)
  nestedTest?: Nested | undefined

  @f.property({ required: false, type: 'int' })
  order?: number

  @f.property({ required: true, type: 'boolean' })
  test: boolean
}

export const FurtherNestedSchema = z.object({
  c: z.boolean(),
  d: z.string().array()
})

export const NestedSchema = z.object({
  a: z.string().array(),
  c: z.number(),
  b: FurtherNestedSchema.optional()
})

export const TypeORMDataModelSchema = z.object({
  id: z.string().optional(),
  created: z.date().optional(),
  order: z.number().optional(),
  nestedTest: NestedSchema.optional(),
  test: z.boolean()
})

export type TypeORMDataModelInputSchema = z.output<
  typeof TypeORMDataModelSchema
>

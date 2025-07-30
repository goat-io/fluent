import { f } from '@goatlab/fluent'
import { z } from 'zod'

class NestedB {
  c: boolean
  d: string[]
}

class NestedTest {
  a: string[]
  b: NestedB
  c: number
}

@f.entity('advanced')
export class AdvancedEntity {
  @f.id()
  id: string

  @f.created()
  created?: Date

  @f.embed(NestedTest)
  nestedTest: NestedTest

  @f.property({ type: 'int' })
  order: number

  @f.property({ type: 'boolean' })
  test: boolean
}

export const AdvancedSchema = z.object({
  id: z.string().optional(),
  created: z.date().optional(),
  nestedTest: z
    .object({
      a: z.array(z.string()),
      b: z.object({
        c: z.boolean(),
        d: z.array(z.string())
      }),
      c: z.number().int()
    })
    .optional(),
  order: z.number().int().optional(),
  test: z.boolean()
})

export type AdvancedInputSchema = z.input<typeof AdvancedSchema>

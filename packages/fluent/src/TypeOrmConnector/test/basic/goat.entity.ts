import { ObjectType } from '../../../core/types'
import { f } from '../../../decorators'
import { z } from 'zod'

// tslint:disable-next-line: max-classes-per-file
@f.entity('goat')
export class GoatEntity {
  @f.id()
  id: string

  @f.property({ required: true, type: 'varchar' })
  name: string

  @f.property({ required: true, type: 'int' })
  age: number

  @f.property({ type: 'varchar' })
  type?: string

  @f.property({ type: 'boolean' })
  active?: boolean

  @f.property({ type: 'float' })
  weight?: number

  @f.embed({ id: Number, value: Number })
  balance?: { id: number; value: number }

  @f.embed({ type: String, family: String })
  breed?: { type: string; family: string }

  @f.created()
  created?: Date

  @f.updated()
  updated?: Date
}

export const GoatSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number(),
  type: z.string().optional(),
  active: z.boolean().optional(),
  weight: z.number().optional(),
  balance: z.object({
    id: z.number(),
    value: z.number()
  }).optional(),
  breed: z.object({
    type: z.string(),
    family: z.string()
  }).optional(),
  created: z.union([z.date(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined) {
      return val
    }
    if (typeof val === 'string') {
      return new Date(val)
    }
    return val
  }),
  updated: z.union([z.date(), z.string()]).nullable().optional().transform((val) => {
    if (val === null || val === undefined) {
      return val
    }
    if (typeof val === 'string') {
      return new Date(val)
    }
    return val
  })
})

export type GoatInputSchema = z.infer<typeof GoatSchema>



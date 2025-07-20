import { f } from '@goatlab/fluent'
import { z } from 'zod'

@f.entity('goats')
export class GoatEntity {
  @f.id()
  id?: string

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

  @f.property({ type: 'varchar' })
  createdBy?: string

  @f.created()
  createdAt?: Date

  @f.updated()
  updatedAt?: Date
}

export const GoatSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  age: z.number().int(),
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
  createdBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

// For updates, make all fields optional except id
export const GoatUpdateSchema = GoatSchema.partial()

export type GoatInputSchema = z.input<typeof GoatSchema>
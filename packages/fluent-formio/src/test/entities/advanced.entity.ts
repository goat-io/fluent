export interface AdvancedEntity {
  id?: string
  created?: string
  nestedTest: {
    a: string[]
    b: {
      c: boolean
      d: string[]
    }
    c: number
  }
  order: number
  test: boolean
}

export type AdvancedInputSchema = Omit<AdvancedEntity, 'id'> & { id?: string }

export const AdvancedSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    created: { type: 'string' },
    nestedTest: {
      type: 'object',
      properties: {
        a: { type: 'array', items: { type: 'string' } },
        b: {
          type: 'object',
          properties: {
            c: { type: 'boolean' },
            d: { type: 'array', items: { type: 'string' } }
          }
        },
        c: { type: 'number' }
      }
    },
    order: { type: 'number' },
    test: { type: 'boolean' }
  },
  required: ['nestedTest', 'order', 'test']
}
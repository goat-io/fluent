export interface GoatEntity {
  id?: string
  name: string
  age: number
  type?: string
  active?: boolean
  weight?: number
  balance?: {
    id: number
    value: number
  }
  breed?: {
    type: string
    family: string
  }
}

export type GoatInputSchema = Omit<GoatEntity, 'id'> & { id?: string }

export const GoatSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    age: { type: 'number' },
    type: { type: 'string' },
    active: { type: 'boolean' },
    weight: { type: 'number' },
    balance: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        value: { type: 'number' }
      }
    },
    breed: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        family: { type: 'string' }
      }
    }
  },
  required: ['name', 'age']
}

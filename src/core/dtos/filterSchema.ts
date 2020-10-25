import { SchemaObject } from '@loopback/rest'

export const getGoatFilterSchema = (model: any, keys?: string[]) => {
  const schema: SchemaObject = {
    title: model.name + 'Filter',
    name: 'filter',
    schema: {
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, example: 100 },
      skip: { type: 'integer', minimum: 0 },
      order: {
        title: 'Form.Fields',
        type: 'object',
        properties: {
          field: { type: 'string' },
          asc: { type: 'boolean' },
          type: { type: 'string' }
        },
        additionalProperties: false
      },
      where: {
        title: 'Form.WhereFilter',
        type: 'object',
        style: 'deepObject',
        explode: 'true',
        properties: {
          and: {
            type: 'array',
            items: {
              type: 'array',
              style: 'deepObject',
              explode: 'true',
              items: {
                type: 'string'
              }
            }
          },
          or: {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        },
        additionalProperties: false
      },
      fields: {
        type: 'array',
        items: {
          type: 'string',
          examples: []
        }
      }
    },
    additionalProperties: false
    // type: 'application/json'
  }

  return schema
}

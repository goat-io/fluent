import { Type } from '../common'
import { SchemaObject } from './open-api-spec.interface'

export interface SchemaObjectMetadata
  extends Omit<SchemaObject, 'type' | 'required'> {
  type?:
    | Type<unknown>
    | ((...args: any[]) => any)
    | [(...args: any[]) => any]
    | string
    | Record<string, any>
  isArray?: boolean
  required?: boolean
  name?: string
  enumName?: string
}

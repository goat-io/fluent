import { Column as TypeORMColumn } from 'typeorm'
import { SchemaObject as LBSchemaObject } from 'openapi3-ts'
import {
  InputTypeOptions,
  InputType as NestInputType
} from './Nestjs/types/decorators/input-type.decorator'
import { PartialType as NestjsPartialType } from './Nestjs/types/decorators/partial-type.helper'
import {
  ObjectTypeOptions,
  ObjectType as NestObjectType
} from './Nestjs/types/object-type.decorator'
import { ApiProperty as NEstJSApiProperty } from './Nestjs/types/decorators/api-property.decorator'
import { OmitType as NEstJSOmitType } from './Nestjs/types/omit-type'
import { ApiHideProperty as NEstApiHideProperty } from './Nestjs/types/decorators/api-hide-property.decorator'
import { jsonToSchemaObject, SchemaRef } from './Loopback/json-to-schema'
import { getJsonSchemaRef, JsonSchemaOptions } from './Loopback/build-schema'

export function LBgetModelSchemaRef<T extends object>(
  modelCtor: Function & { prototype: T },
  options?: JsonSchemaOptions<T>
): SchemaRef {
  const jsonSchema = getJsonSchemaRef(modelCtor, options)
  return jsonToSchemaObject(jsonSchema) as SchemaRef
}

export const ApiProperty = NEstJSApiProperty
export const ApiHideProperty = NEstApiHideProperty
export const OmitType = NEstJSOmitType
export const InputType = NestInputType
export const PartialType = NestjsPartialType
export const Column = TypeORMColumn
export const getModelSchemaRef = LBgetModelSchemaRef
export const ObjectType = NestObjectType
export type SchemaObject = LBSchemaObject

export function HideField(): PropertyDecorator {
  // tslint:disable-next-line: no-empty
  return (target: Record<string, any>, propertyKey: string | symbol) => {}
}

import { Column as TypeORMColumn } from 'typeorm'
import { InputTypeOptions } from './Nestjs/types/decorators/input-type.decorator'
import { PartialType as NestjsPartialType } from './Nestjs/types/decorators/partial-type.helper'
import { ObjectTypeOptions } from './Nestjs/types/object-type.decorator'
import { ApiProperty as NEstJSApiProperty } from './Nestjs/types/decorators/api-property.decorator'
import { OmitType as NEstJSOmitType } from './Nestjs/types/omit-type'
import { ApiHideProperty as NEstApiHideProperty } from './Nestjs/types/decorators/api-hide-property.decorator'
import { SchemaObject as NESTSchemaObject } from './Nestjs/types/interfaces/open-api-spec.interface'
import { jsonToSchemaObject, SchemaRef } from './Loopback/json-to-schema'
import { getJsonSchemaRef, JsonSchemaOptions } from './Loopback/build-schema'

export function NestInputType(
  nameOrOptions?: string | InputTypeOptions,
  inputTypeOptions?: InputTypeOptions
): ClassDecorator {
  return target => {}
}

export function NestObjectType(
  nameOrOptions?: string | ObjectTypeOptions,
  objectTypeOptions?: ObjectTypeOptions
): ClassDecorator {
  return target => {}
}

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
export type SchemaObject = NESTSchemaObject

export function HideField(): PropertyDecorator {
  // tslint:disable-next-line: no-empty
  return (target: Record<string, any>, propertyKey: string | symbol) => {}
}
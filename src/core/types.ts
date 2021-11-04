import {
  ApiProperty as NEstJSApiProperty,
  OmitType as NEstJSOmitType
} from '@nestjs/swagger'
import {
  InputType as QLInputType,
  PartialType as QLPartialType,
  ObjectType as NestObjectType
} from '@nestjs/graphql'
import { Column as TypeORMColumn } from 'typeorm'
import {
  getModelSchemaRef as LBgetModelSchemaRef,
  SchemaObject as LBSchemaObject
} from '@loopback/rest'

export const ApiProperty = NEstJSApiProperty
export const OmitType = NEstJSOmitType
export const InputType = QLInputType
export const PartialType = QLPartialType
export const Column = TypeORMColumn
export const getModelSchemaRef = LBgetModelSchemaRef
export const ObjectType = NestObjectType
export type SchemaObject = LBSchemaObject

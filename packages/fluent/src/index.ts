import {
  ApiHideProperty,
  ApiProperty,
  Column,
  HideField,
  InputType,
  ObjectType,
  OmitType,
  PartialType,
  getModelSchemaRef
} from './core/types'
import type {
  AnyObject,
  Deleted,
  LogicOperator,
  PaginatedData,
  Paginator,
  Primitives,
  PrimitivesArray,
} from './types'
import { PaginationLinks, PaginationMeta } from './core/dtos/pagination.dto'
import { Access } from './core/dtos/access.dto'
import { BaseConnector } from './BaseConnector'
import { Collection } from '@goatlab/js-utils'
import { Decorators } from './decorators'
import { Fluent } from './Fluent'
import type { FluentConnectorInterface } from './BaseConnector'
import type { SchemaObject } from './core/types'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
import { getOutputKeys } from './outputKeys'
import { loadRelations } from './loadRelations'
import { modelGeneratorDataSource } from './generatorDatasource'
import {Cache} from './cache'
import { ValidationError } from 'class-validator'

export { DataSource } from 'typeorm'
export {
  Access,
  ApiHideProperty,
  ApiProperty,
  BaseConnector,
  Collection,
  Column,
  Decorators,
  Fluent,
  getModelSchemaRef,
  getOutputKeys,
  HideField,
  InputType,
  loadRelations,
  modelGeneratorDataSource,
  ObjectType,
  OmitType,
  PaginationLinks,
  PaginationMeta,
  PartialType,
  TypeOrmConnector,
  Cache
}

interface ValidatedInput<T> {
  errors: ValidationError[] | null
  result: Awaited<T>
}

export type {
  AnyObject as BaseDataElement,
  Deleted,
  FluentConnectorInterface,
  LogicOperator,
  PaginatedData,
  Paginator,
  Primitives,
  PrimitivesArray,
  SchemaObject,
  ValidatedInput
}

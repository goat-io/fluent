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
  PaginatedData,
  Paginator,
  Primitives,
  PrimitivesArray,
  FluentQuery,
  QueryOutput,
} from './types'
import {LogicOperator} from './types'
import { PaginationLinks, PaginationMeta } from './core/dtos/pagination.dto'
import { Access } from './core/dtos/access.dto'
import { BaseConnector } from './BaseConnector'
import { Collection } from '@goatlab/js-utils'
import { f } from './decorators'
import { Fluent } from './Fluent'
import type { FluentConnectorInterface } from './BaseConnector'
import type { SchemaObject } from './core/types'
import { getRelationsFromModelGenerator, TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
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
  f,
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
  Cache,
  getRelationsFromModelGenerator,
  LogicOperator
}

interface ValidatedInput<T> {
  errors: ValidationError[] | null
  result: Awaited<T>
}

export type {
  AnyObject,
  Deleted,
  FluentConnectorInterface,
  PaginatedData,
  Paginator,
  Primitives,
  PrimitivesArray,
  SchemaObject,
  ValidatedInput,
  FluentQuery,
  QueryOutput,
}

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
  BaseDataElement,
  DaoOutput,
  Deleted,
  Filter,
  LogicOperator,
  PaginatedData,
  Paginator,
  Paths,
  Primitives,
  PrimitivesArray,
  Sure,
  WhereClause
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
  BaseDataElement,
  DaoOutput,
  Deleted,
  Filter,
  FluentConnectorInterface,
  LogicOperator,
  PaginatedData,
  Paginator,
  Paths,
  Primitives,
  PrimitivesArray,
  Sure,
  WhereClause,
  SchemaObject,
  ValidatedInput
}

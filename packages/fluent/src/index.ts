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
  LoadedResult,
  FindByIdFilter
} from './types'
import { LogicOperator } from './types'
import { BaseConnector } from './BaseConnector'
import { Collection } from '@goatlab/js-utils'
import { f } from './decorators'
import { Fluent } from './Fluent'
import type { FluentConnectorInterface } from './FluentConnectorInterface'
import type { SchemaObject } from './core/types'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
import { getOutputKeys } from './outputKeys'
import { loadRelations } from './loadRelations'
import { modelGeneratorDataSource } from './generatorDatasource'
import { Cache } from '@goatlab/js-utils/src/Cache'
import { ValidationError } from 'class-validator'
import { extractConditions } from './TypeOrmConnector/util/extractConditions'
import { extractInclude } from './TypeOrmConnector/util/extractInclude'
import { extractMetadataFromKeys } from './TypeOrmConnector/util/extractMetadataFromKeys'
import { extractOrderBy } from './TypeOrmConnector/util/extractOrderBy'
import { getRelationsFromModelGenerator } from './TypeOrmConnector/util/getRelationsFromModelGenerator'
import { getSelectedKeysFromRawSql } from './TypeOrmConnector/util/getSelectedKeysFromRawSql'
import { nestQueryResults } from './TypeOrmConnector/util/nestQueryResults'

export { DataSource } from 'typeorm'
export type { Relation } from 'typeorm'
export {
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
  PartialType,
  TypeOrmConnector,
  Cache,
  getRelationsFromModelGenerator,
  LogicOperator,
  extractConditions,
  extractInclude,
  extractMetadataFromKeys,
  extractOrderBy,
  getSelectedKeysFromRawSql,
  nestQueryResults
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
  LoadedResult,
  FindByIdFilter
}

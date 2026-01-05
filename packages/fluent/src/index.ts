import { Collection } from '@goatlab/js-utils'
import { Cache } from '@goatlab/node-backend'
import { ValidationError } from 'class-validator'
import { BaseConnector } from './BaseConnector'
import type { SchemaObject } from './core/types'
import {
  ApiHideProperty,
  ApiProperty,
  Column,
  getModelSchemaRef,
  HideField,
  InputType,
  ObjectType,
  OmitType,
  PartialType,
} from './core/types'
import { f } from './decorators'
import { collect, initialize } from './Fluent'
import type { FluentConnectorInterface } from './FluentConnectorInterface'
import { modelGeneratorDataSource } from './generatorDatasource'
import { loadRelations } from './loadRelations'
import { getOutputKeys } from './outputKeys'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
import { extractConditions } from './TypeOrmConnector/util/extractConditions'
import { extractInclude } from './TypeOrmConnector/util/extractInclude'
import { extractMetadataFromKeys } from './TypeOrmConnector/util/extractMetadataFromKeys'
import { extractOrderBy } from './TypeOrmConnector/util/extractOrderBy'
import { getRelationsFromModelGenerator } from './TypeOrmConnector/util/getRelationsFromModelGenerator'
import { getSelectedKeysFromRawSql } from './TypeOrmConnector/util/getSelectedKeysFromRawSql'
import { nestQueryResults } from './TypeOrmConnector/util/nestQueryResults'
import type {
  AnyObject,
  Deleted,
  FindByIdFilter,
  FluentQuery,
  LoadedResult,
  PaginatedData,
  Paginator,
  Primitives,
  PrimitivesArray,
  QueryOutput,
} from './types'
import { LogicOperator } from './types'

export type { Relation } from 'typeorm'
export { DataSource } from 'typeorm'
export {
  TypeORMDataModel as TypeOrmEntity,
  type TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
} from './TypeOrmConnector/test/advanced/typeOrm.entity'
export {
  GoatEntity,
  type GoatInputSchema,
  GoatSchema,
} from './TypeOrmConnector/test/basic/goat.entity'
export type {
  TestConnector,
  UnifiedTestOptions,
} from './testing/unifiedTestFactory'
// Export test utilities for connector packages
export { createUnifiedTests } from './testing/unifiedTestFactory'
// Export Fluent object for backward compatibility
export const Fluent = {
  initialize,
  collect,
}

export {
  ApiHideProperty,
  ApiProperty,
  BaseConnector,
  Collection,
  Column,
  f,
  collect,
  initialize,
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
  nestQueryResults,
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
  FindByIdFilter,
}

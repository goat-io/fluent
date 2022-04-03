import { BaseConnector } from './BaseConnector'
import type { FluentConnectorInterface } from './BaseConnector'
import { Collection } from '@goatlab/js-utils'
import { Fluent } from './Fluent'
import { modelGeneratorDataSource } from './generatorDatasource'
import { getOutputKeys } from './outputKeys'
import { Decorators } from './core/database/decorators'
import type {
  BaseDaoExtendedAttributes,
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
import {
  ApiProperty,
  ApiHideProperty,
  OmitType,
  InputType,
  PartialType,
  Column,
  getModelSchemaRef,
  ObjectType,
  HideField
} from './core/types'
import type { SchemaObject } from './core/types'
import { createConnection } from './core/database/createConnection'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
import { loadRelations } from './loadRelations'
export {
  BaseConnector,
  Collection,
  createConnection,
  Decorators,
  Fluent,
  getOutputKeys,
  modelGeneratorDataSource,
  ApiProperty,
  ApiHideProperty,
  OmitType,
  InputType,
  PartialType,
  Column,
  getModelSchemaRef,
  ObjectType,
  HideField,
  TypeOrmConnector,
  loadRelations
}

export type {
  BaseDaoExtendedAttributes,
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
  SchemaObject
}

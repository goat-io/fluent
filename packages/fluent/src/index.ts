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
import { PaginationLinks, PaginationMeta } from './core/dtos/pagination.dto'

import { Access } from './core/dtos/access.dto'
import { BaseConnector } from './BaseConnector'
import { Collection } from '@goatlab/js-utils'
import { Decorators } from './core/database/decorators'
import { Fluent } from './Fluent'
import type { FluentConnectorInterface } from './BaseConnector'
import type { SchemaObject } from './core/types'
import { TypeOrmConnector } from './TypeOrmConnector/TypeOrmConnector'
import { createConnection } from './core/database/createConnection'
import { getOutputKeys } from './outputKeys'
import { loadRelations } from './loadRelations'
import { modelGeneratorDataSource } from './generatorDatasource'

export {
  Access,
  ApiHideProperty,
  ApiProperty,
  BaseConnector,
  Collection,
  Column,
  createConnection,
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
  TypeOrmConnector
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

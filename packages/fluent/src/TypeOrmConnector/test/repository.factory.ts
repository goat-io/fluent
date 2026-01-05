import { DataSource } from 'typeorm'
import { TypeOrmConnector } from '../TypeOrmConnector'
import {
  TypeORMDataModel,
  TypeORMDataModelInputSchema,
  TypeORMDataModelSchema,
} from './advanced/typeOrm.entity'
import { GoatEntity, GoatInputSchema, GoatSchema } from './basic/goat.entity'

export class GoatRepositoryFactory extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor(dataSource: DataSource) {
    super({
      entity: GoatEntity,
      dataSource: dataSource,
      inputSchema: GoatSchema,
    })
  }
}

export class TypeOrmRepositoryFactory extends TypeOrmConnector<
  TypeORMDataModel,
  TypeORMDataModelInputSchema
> {
  constructor(dataSource: DataSource) {
    super({
      entity: TypeORMDataModel,
      dataSource: dataSource,
      inputSchema: TypeORMDataModelSchema,
    })
  }
}

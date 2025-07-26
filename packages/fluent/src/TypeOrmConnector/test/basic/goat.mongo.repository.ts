import { DataSource } from 'typeorm'
import {  GoatInputSchema, GoatSchema, GoatEntity } from './goat.entity'
import { TypeOrmConnector } from '../../TypeOrmConnector'

export class GoatRepository extends TypeOrmConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor(dataSource?: DataSource | (() => DataSource)) {
    super({
      entity: GoatEntity,
      dataSource: dataSource || (() => {
        throw new Error('DataSource not provided to GoatRepository')
      }),
      inputSchema: GoatSchema
    })
  }
}

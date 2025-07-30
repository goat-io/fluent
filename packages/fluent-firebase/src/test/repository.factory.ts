import { DataSource } from 'typeorm'
import { FirebaseConnector } from '../FirebaseConnector'
import { GoatEntity, TypeOrmEntity } from './test-entities'
import {
  GoatInputSchema,
  GoatSchema,
  TypeOrmInputSchema,
  TypeOrmSchema
} from './test-schemas'

// The unified test suite expects these exact class names
export class GoatRepositoryFactory extends FirebaseConnector<
  GoatEntity,
  GoatInputSchema
> {
  constructor(_dataSource: DataSource) {
    // Firebase doesn't use DataSource, so we ignore it
    super({
      entity: GoatEntity,
      inputSchema: GoatSchema
    })
  }
}

export class TypeOrmRepositoryFactory extends FirebaseConnector<
  TypeOrmEntity,
  TypeOrmInputSchema
> {
  constructor(_dataSource: DataSource) {
    // Firebase doesn't use DataSource, so we ignore it
    super({
      entity: TypeOrmEntity,
      inputSchema: TypeOrmSchema,
      outputSchema: TypeOrmSchema
    })
  }
}

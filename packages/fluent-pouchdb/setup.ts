import 'reflect-metadata'
import { Fluent, GoatEntity, TypeOrmEntity } from '@goatlab/fluent'

const pouchdbEntities = [GoatEntity, TypeOrmEntity]

export async function setup() {
  await Fluent.initialize([], pouchdbEntities)
}

setup()
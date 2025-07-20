import 'reflect-metadata'
import { Fluent, GoatEntity, TypeOrmEntity } from '@goatlab/fluent'

const lokiEntities = [GoatEntity, TypeOrmEntity]

export async function setup() {
  await Fluent.initialize([], lokiEntities)
}

setup()

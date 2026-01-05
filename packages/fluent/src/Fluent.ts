import { Collection } from '@goatlab/js-utils'
import { DataSource } from 'typeorm'
import { modelGeneratorDataSource } from './generatorDatasource'
import { AnyObject, Primitives } from './types'

/**
 *
 * @param args
 */
export function collect<T = AnyObject | Primitives>(data: T[]): Collection<T> {
  return new Collection<T>(data)
}

export async function initialize(
  dataSources: DataSource[],
  Entities: any[],
): Promise<void> {
  // If modelGeneratorDataSource is already initialized with the same entities, skip
  if (modelGeneratorDataSource.isInitialized) {
    // Check if entities are the same
    const currentEntities = modelGeneratorDataSource.options.entities || []
    const areEntitiesEqual =
      Array.isArray(currentEntities) &&
      currentEntities.length === Entities.length &&
      currentEntities.every((entity, index) => entity === Entities[index])

    if (areEntitiesEqual) {
      // Already initialized with the same entities, just initialize other data sources
      for (const dataSource of dataSources) {
        if (!dataSource.isInitialized) {
          await dataSource.initialize()
        }
      }
      return
    }

    // Different entities, need to reinitialize
    await modelGeneratorDataSource.destroy()
  }

  // Set the entities on the modelGeneratorDataSource
  modelGeneratorDataSource.setOptions({ entities: Entities })

  // Initialize the modelGeneratorDataSource
  await modelGeneratorDataSource.initialize()

  // Initialize all provided data sources
  for (const dataSource of dataSources) {
    if (!dataSource.isInitialized) {
      await dataSource.initialize()
    }
  }
}

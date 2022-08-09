import { DataSource } from 'typeorm'
import { AnyObject, Primitives } from './types'
import { Collection } from '@goatlab/js-utils'
import { modelGeneratorDataSource } from './generatorDatasource'

export class Fluent {
  /**
   *
   * @param args
   */
  public static collect<T = AnyObject | Primitives>(data: T[]): Collection<T> {
    return new Collection<T>(data)
  }

  public static async initialize(
    dataSources: DataSource[],
    Entities: any[]
  ): Promise<void> {
    modelGeneratorDataSource.setOptions({ entities: Entities })
    if (!modelGeneratorDataSource.isInitialized) {
      await modelGeneratorDataSource.initialize()
    }

    for (const dataSource of dataSources) {
      if (!dataSource.isInitialized) {
        await dataSource.initialize()
      }
    }
  }
}

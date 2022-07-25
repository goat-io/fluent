import { typedPath } from 'typed-path'
import { DataSource } from 'typeorm'
import { AnyObject, Primitives } from './types'
import { Collection } from '@goatlab/js-utils'
import { modelGeneratorDataSource } from './generatorDatasource'

interface _FLUENT_ {
  models?: {
    [key: string]: boolean
  }
}

declare global {
  interface Window {
    _FLUENT_: _FLUENT_
  }
  namespace NodeJS {
    interface Global {
      _FLUENT_: _FLUENT_
    }
  }
}

if (typeof window !== 'undefined' && window && !window._FLUENT_) {
  window._FLUENT_ = {
    models: {}
  }
}

if (global && !global._FLUENT_) {
  global._FLUENT_ = {
    models: {}
  }
}

export class Fluent {
  private static registerModel<T = AnyObject>(name?: string) {
    if (!name || name === 'baseModel') {
      return
    }

    if (typeof window !== 'undefined') {
      if (window._FLUENT_.models) {
        window._FLUENT_.models[name] = true
      }

      return
    }
    global._FLUENT_.models[name] = true
  }

  /**
   *
   */
  public static model<T = AnyObject>(name: string): any {
    this.registerModel<T>(name)
    return typedPath<T>()
  }

  /**
   *
   * @param args
   */
  public static collect<T = AnyObject | Primitives>(data: T[]): Collection<T> {
    return new Collection<T>(data)
  }

  public static getConfig(): any {
    if (typeof window !== 'undefined' && window) {
      return window._FLUENT_
    }

    if (typeof global !== 'undefined' && global) {
      return global._FLUENT_
    }
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

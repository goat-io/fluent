import { typedPath } from 'typed-path'
import { DataSource } from 'typeorm'
import { BaseDataElement, BaseDaoExtendedAttributes, Primitives } from './types'
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
  private static registerModel<T = BaseDataElement>(name?: string) {
    if (!name || name === 'baseModel') {
      return
    }

    if (typeof window !== 'undefined') {
      window._FLUENT_.models[name] = true
      return
    }
    global._FLUENT_.models[name] = true
  }

  /**
   *
   */
  public static model<T = BaseDataElement>(name: string): any {
    this.registerModel<T & BaseDaoExtendedAttributes>(name)
    return typedPath<T & BaseDaoExtendedAttributes>()
  }

  /**
   *
   * @param args
   */
  public static collect<T = BaseDataElement | Primitives>(
    data: T[]
  ): Collection<T> {
    return new Collection<T>(data)
  }

  public static getConfig(): _FLUENT_ {
    if (typeof window !== 'undefined' && window) {
      return window._FLUENT_
    }

    if (typeof global !== 'undefined' && global) {
      return global._FLUENT_
    }
  }

  public static async models(Entities: any[]): Promise<DataSource> {
    modelGeneratorDataSource.setOptions({ entities: Entities })
    if (modelGeneratorDataSource.isInitialized) {
      return modelGeneratorDataSource
    }
    await modelGeneratorDataSource.initialize()

    return modelGeneratorDataSource
  }
}

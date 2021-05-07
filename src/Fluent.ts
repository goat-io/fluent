import {
  IDataElement,
  IGoatExtendedAttributes,
  Primitives
} from './Providers/types'
import { typedPath } from 'typed-path'
import { createConnection, getConnection } from 'typeorm'

import { Collection } from './Collection'

export interface _FLUENT_ {
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
  private static registerModel<T = IDataElement>(name?: string) {
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
  public static model<T = IDataElement>(name: string): any {
    this.registerModel<T & IGoatExtendedAttributes>(name)
    return typedPath<T & IGoatExtendedAttributes>()
  }
  /**
   *
   * @param args
   */
  public static collect<T = IDataElement | Primitives>(
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

  public static async models(Entities: any[]) {
    try {
      getConnection('_goat_model_generator')
    } catch (error) {
      await createConnection({
        name: '_goat_model_generator',
        type: 'sqlite',
        entities: Entities,
        database: ':memory:',
        logging: false,
        synchronize: true,
        dropSchema: true
      })
    }
  }
}

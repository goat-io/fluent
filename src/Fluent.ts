import { IDataElement } from './BaseConnector'
import { Collection } from './Collection'
import { GoatModelConfig, Model } from './Model'
import { PrimitivesArray } from './Providers/types'

export interface _FLUENT_ {
  connectors: {
    local?: any[]
    remote?: any[]
    merge?: any[]
  }
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

export enum connectorTypes {
  local = 'local',
  remote = 'remote',
  merge = 'merge'
}

interface registerConnectorInterface {
  type: connectorTypes
  connector: any
}

interface deRegisterConnectorInterface {
  type: connectorTypes
  name: string
}

export class Fluent {
  public static registerModel(name?: string) {
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
  public static model(name: string, config?: GoatModelConfig): Model {
    this.registerModel(name)
    return new Model(name, config)
  }
  /**
   *
   * @param args
   */
  public static collect(data: IDataElement[] | PrimitivesArray): Collection {
    return new Collection(data)
  }

  public static getConfig(): _FLUENT_ {
    if (typeof window !== 'undefined' && window) {
      return window._FLUENT_
    }

    if (typeof global !== 'undefined' && global) {
      return global._FLUENT_
    }
  }

  constructor() {}
  /**
   *
   * @param param0
   */
  public registerConnector({ type, connector }: registerConnectorInterface): void {
    if (!type || !connector) {
      throw new Error('type and connector must be defined')
    }

    const ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_
    const connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : []

    if (connectors.length === 0) {
      connector = {
        ...connector,
        default: true
      }

      connectors.push(connector)
      ctx.connectors[type] = connectors
      return
    }

    if (connectors.find(o => o.name === connector.name)) {
      console.log(`A ${type} connector with the name '${connector.name}' already exists`)
      return
    }

    connectors.push(connector)
    ctx.connectors[type] = connectors
  }
  /**
   *
   * @param param0
   */
  public deregisterConnector({ type, name }: deRegisterConnectorInterface): void {
    if (!type || !name) {
      throw new Error('type and name must be defined')
    }

    const ctx = typeof window !== 'undefined' && window ? window._FLUENT_ : global._FLUENT_
    const connectors = ctx.connectors.hasOwnProperty(type) ? ctx.connectors[type] : []

    if (connectors.length === 0) {
      return
    }

    const filteredConnectors = connectors.filter((o: any) => o.name !== name)
    ctx.connectors[type] = filteredConnectors
  }
  /*
   * @param param0
   */
  public config({ REMOTE_CONNECTORS, LOCAL_CONNECTORS, MERGE_CONNECTORS }) {
    this.registerGlobalVariable()
    if (typeof window !== 'undefined' && window && window._FLUENT_) {
      window._FLUENT_.connectors = {
        local: LOCAL_CONNECTORS,
        merge: MERGE_CONNECTORS,
        remote: REMOTE_CONNECTORS
      }
    }

    if (typeof global !== 'undefined' && global && global._FLUENT_) {
      global._FLUENT_.connectors = {
        local: LOCAL_CONNECTORS,
        merge: MERGE_CONNECTORS,
        remote: REMOTE_CONNECTORS
      }
    }
  }
  /**
   *
   */
  private registerGlobalVariable(): void {
    if (typeof window !== 'undefined' && window && !window._FLUENT_) {
      window._FLUENT_ = {
        connectors: {},
        models: {}
      }
    }

    if (global && !global._FLUENT_) {
      global._FLUENT_ = {
        connectors: {},
        models: {}
      }
    }
  }
}

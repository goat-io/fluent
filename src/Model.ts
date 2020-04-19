import { BaseConnector } from './BaseConnector'
import { _FLUENT_ } from './Fluent'

export interface GoatModelConfig {
  remote?: {
    path?: string
    token?: string
    pullForm?: boolean
  }
  local?: {
    connector?: string
  }
  merge?: {
    connector?: string
  }
}

export class Model {
  private name: string = 'baseModel'
  private config: GoatModelConfig = {
    local: {
      connector: 'loki'
    },
    merge: {
      connector: 'formio-loki'
    },
    remote: {
      path: undefined,
      pullForm: false,
      token: undefined
    }
  }
  constructor(name: string, config?: GoatModelConfig) {
    this.name = name
    this.config = config || this.config
  }
  /**
   *
   */
  public getModelName(): string {
    return this.name
  }
  /**
   *
   * @param param0
   */
  public remote({
    token = undefined,
    pullForm = undefined,
    connectorName = undefined,
    path = undefined
  } = {}): BaseConnector {
    const FLUENT = this.getFluentConfig()
    const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.remote

    if (!connectors) {
      throw new Error('No remote connector was defined. Please define it using Fluent.config()')
    }

    const remoteConnector = this.getConnector(connectors, 'remote', connectorName || false)
    this.config.remote.token = token || this.config.remote.token
    this.config.remote.path = path || this.config.remote.path

    if (pullForm) {
      this.config.remote.pullForm = pullForm || this.config.remote.pullForm
    }

    if (remoteConnector) {
      const connector: BaseConnector = new remoteConnector.connector({
        connector: remoteConnector,
        remoteConnection: this.config.remote
      })
      return connector
    }

    throw new Error('No default remote connector found. Please assign one as your default in your Fluent constructor')
  }
  /**
   *
   * @param param0
   */
  public local({ connectorName = undefined } = {}): BaseConnector {
    const FLUENT = this.getFluentConfig()
    const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.local

    if (!connectors) {
      throw new Error('No local connector was defined. Please define it using Fluent.config()')
    }

    const localConnector = this.getConnector(connectors, 'local', connectorName || false)

    if (localConnector) {
      const connector: BaseConnector = new localConnector.connector({
        connector: localConnector,
        name: this.name
      })

      return connector
    }

    throw new Error('No default local connector found. Please assign one as your default in Fluent.config')
  }
  /**
   *
   */
  public merged() {
    const local = this.local()
    const remote = this.remote()

    const FLUENT = this.getFluentConfig()
    const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.merge

    if (!connectors) {
      throw new Error('No merge connector was defined. Please define it using Fluent.config()')
    }

    const mergeConnector = this.getConnector(connectors, 'merge')

    if (mergeConnector) {
      const connector: BaseConnector = new mergeConnector.connector({
        connector: mergeConnector,
        local,
        name: this.name,
        remote
      })

      return connector
    }

    throw new Error('No default merge connector found. Please assign one as your default in Fluent.config')
  }
  /**
   *
   */
  private getFluentConfig(): _FLUENT_ {
    let FLUENT: _FLUENT_
    if (typeof window !== 'undefined' && window && window._FLUENT_) {
      FLUENT = window._FLUENT_
    } else if (global && global._FLUENT_) {
      FLUENT = global._FLUENT_
    }

    return FLUENT
  }
  /**
   *
   * @param connectors
   * @param type
   * @param connectorName
   */
  private getConnector(connectors, type, connectorName = false) {
    if (Array.isArray(connectors)) {
      return this.getConnectorFromArray(connectors, type, connectorName)
    }

    if (connectors instanceof Object) {
      return connectors
    }

    return undefined
  }
  /**
   *
   * @param connectors
   * @param type
   * @param connectorName
   */
  private getConnectorFromArray(connectors, type, connectorName = false) {
    // Default case
    if (connectors.length === 1) {
      return connectors[0]
    }

    // If the model assigns specific one
    if (this.config && this.config[type] && this.config[type].connector) {
      const Lcon = connectors.find(c => c.name === this.config[type].connector)

      if (Lcon instanceof Object) {
        return Lcon
      }
    }

    // If connectorName is specified
    if (connectorName) {
      const Lcon = connectors.find(c => c.name === connectorName)

      if (Lcon instanceof Object) {
        return Lcon
      }
    }

    const base = connectors.find(c => c.default)

    if (base instanceof Object) {
      return base
    }

    return undefined
  }
}

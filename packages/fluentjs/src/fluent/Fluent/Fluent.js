import stampit from '@stamp/it'
import Model from './Model'
import Collection from './Collection'

const Fluent = stampit({
  init() {
    this.registerGlobalVariable()
  },
  properties: {},
  methods: {
    model(...args) {
      this.registerModel(args)
      return Model.compose(...args)
    },
    extend(...args) {
      this.registerModel(args)
      return Model.compose(...args)
    },
    compose(...args) {
      this.registerModel(args)
      return Model.compose(...args)
    },
    collect(args) {
      return Collection(args)
    },
    registerGlobalVariable() {
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
    },
    registerModel(args) {
      let name =
        args && args[0] && args[0].properties && args[0].properties.name
          ? args[0].properties.name
          : undefined

      if (!name || name === 'baseModel') {
        return
      }

      if (!(typeof name === 'string')) {
        throw new Error(
          'You must assign a name to your Model when using Fluent.compose'
        )
      }

      if (typeof window !== 'undefined') {
        window._FLUENT_.models[name] = true
        return
      }
      global._FLUENT_.models[name] = true
    },
    config({
      REMOTE_CONNECTORS = undefined,
      LOCAL_CONNECTORS = undefined,
      MERGE_CONNECTORS = undefined
    }) {
      if (typeof window !== 'undefined' && window) {
        window._FLUENT_.connectors = {
          local: LOCAL_CONNECTORS,
          remote: REMOTE_CONNECTORS,
          merge: MERGE_CONNECTORS
        }
      }

      if (typeof global !== 'undefined' && global) {
        global._FLUENT_.connectors = {
          local: LOCAL_CONNECTORS,
          remote: REMOTE_CONNECTORS,
          merge: MERGE_CONNECTORS
        }
      }
    },
    getConfig() {
      if (typeof window !== 'undefined' && window) {
        return window._FLUENT_
      }

      if (typeof global !== 'undefined' && global) {
        return global._FLUENT_
      }
    },
    registerConnector({ type, connector }) {
      if (!type || !connector)
        throw new Error('type and connector must be defined')
      if (!['local', 'remote', 'merge'].includes(type))
        throw new Error('type must be either local, remote or merge')

      const ctx =
        typeof window !== 'undefined' && window
          ? window._FLUENT_
          : global._FLUENT_
      const connectors = ctx.connectors.hasOwnProperty(type)
        ? ctx.connectors[type]
        : []

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
        console.log(
          `A ${type} connector with the name '${connector.name}' already exists`
        )
        return
      }

      connectors.push(connector)
      ctx.connectors[type] = connectors
    },
    deregisterConnector({ type, name }) {
      if (!type || !name) throw new Error('type and name must be defined')
      if (!['local', 'remote', 'merge'].includes(type))
        throw new Error('type must be either local, remote or merge')

      const ctx =
        typeof window !== 'undefined' && window
          ? window._FLUENT_
          : global._FLUENT_
      const connectors = ctx.connectors.hasOwnProperty(type)
        ? ctx.connectors[type]
        : []

      if (connectors.length === 0) return

      const filteredConnectors = connectors.filter(o => o.name !== name)
      ctx.connectors[type] = filteredConnectors
    }
  }
})()

export default Fluent

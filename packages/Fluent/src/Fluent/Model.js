import stampit from '@stamp/it';
import Privatize from '@stamp/privatize';

export default stampit({
  properties: {
    name: 'baseModel',
    config: {
      remote: {
        path: undefined,
        token: undefined,
        pullForm: false
      },
      local: {
        connector: 'loki'
      },
      merge: {
        connector: 'formio-loki'
      }
    }
  },
  methods: {
    /**
     * 
     */
    getModelName() {
      return this.name;
    },
    /**
     * 
     */
    getFluentConfig() {
      let FLUENT;
      if ((typeof window !== 'undefined') && window && window._FLUENT_) {
        FLUENT = window._FLUENT_
      } else if (global && global._FLUENT_) {
        FLUENT = global._FLUENT_
      }

      return FLUENT
    },
    /**
     * 
     * @param {*} connectors 
     * @param {*} type 
     */
    getConnector(connectors, type, connectorName = false) {
      if (Array.isArray(connectors)) {
        return this.getConnectorFromArray(connectors, type, connectorName)
      }

      if (connectors instanceof Object) {
        return connectors
      }

      return undefined
    },
    /**
     * 
     * @param {*} connectors 
     * @param {*} type 
     */
    getConnectorFromArray(connectors, type, connectorName = false) {
      // Default case
      if (connectors.length === 1) return connectors[0];

      // If the model assigns specific one
      if (this.config && this.config[type] && this.config[type].connector) {
        const Lcon = connectors.find(c => c.name === this.config[type].connector);

        if (Lcon instanceof Object) return Lcon;
      }

      // If connectorName is specified
      if (connectorName) {
        const Lcon = connectors.find(c => c.name === connectorName);

        if (Lcon instanceof Object) return Lcon;
      }

      const base = connectors.find(c => c.default);

      if (base instanceof Object) return base;

      return undefined;
    },
    /**
     * [remote description]
     * @return {[type]} [description]
     */
    remote({ token = undefined, pullForm = undefined, connectorName = undefined } = {}) {
      const FLUENT = this.getFluentConfig();
      const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.remote;

      if (!connectors) {
        throw new Error('No remote connector was defined. Please define it using Fluent.config()');
      }

      const remoteConnector = this.getConnector(connectors, 'remote', connectorName || false);

      this.config.remote.token = token || this.config.remote.token;

      if (pullForm) {
        this.config.remote.pullForm = pullForm || this.config.remote.pullForm;
      }

      if (remoteConnector) {
        return remoteConnector.connector({
          remoteConnection: this.config.remote,
          connector: remoteConnector
        })
      }

      throw new Error('No default remote connector found. Please assign one as your default in Fluent.config')
    },
    /**
     * [local description]
     * @return {[type]} [description]
     */
    local({ connectorName = undefined } = {}) {
      const FLUENT = this.getFluentConfig();
      const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.local;

      if (!connectors) throw new Error('No local connector was defined. Please define it using Fluent.config()');

      const localConnector = this.getConnector(connectors, 'local', connectorName || false);

      if (localConnector) return localConnector.connector({ name: this.name, connector: localConnector });

      throw new Error('No default local connector found. Please assign one as your default in Fluent.config')

    },
    /**
    * [local description]
    * @return {[type]} [description]
    */
    merged() {
      const local = this.local();
      const remote = this.remote();

      const FLUENT = this.getFluentConfig();
      const connectors = FLUENT && FLUENT.connectors && FLUENT.connectors.merge;

      if (!connectors) {
        throw new Error('No merge connector was defined. Please define it using Fluent.config()')
      }

      const mergeConnector = this.getConnector(connectors, 'merge')

      if (mergeConnector) {
        return mergeConnector.connector({ local, remote, name: this.name, connector: mergeConnector })
      }

      throw new Error('No default merge connector found. Please assign one as your default in Fluent.config')
    }
  }
}).compose(Privatize);

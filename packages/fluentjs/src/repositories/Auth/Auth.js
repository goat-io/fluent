import stampit from '@stamp/it'
import Formio from './Connectors/Formio'
import Keycloak from './Connectors/Keycloak'
import Loopback from './Connectors/Loopback'

export default stampit({
  init({ baseUrl }) {
    this.baseUrl = baseUrl
  },
  properties: {
    default: 'Formio',
    baseUrl: undefined,
    connectors: {
      Formio,
      Keycloak,
      Loopback
    }
  },
  methods: {
    getConnector(connector) {
      return this.connectors[connector]({ baseUrl: this.baseUrl })
    },
    connector(connectorName) {
      if (!connectorName) return this.getConnector(this.default)

      return this.getConnector(connectorName)
    }
  }
})

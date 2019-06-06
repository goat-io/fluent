import stampit from '@stamp/it'
import Pusher from './Connectors/Pusher'

export default stampit({
  init({ connector }: { connector: string }) {
    this.default = connector || this.default
  },
  properties: {
    connectors: {
      Pusher
    },
    default: 'Pusher'
  },
  methods: {
    connector(params: object): any {
      return this.getConnector(this.default)(params)
    },
    getConnector(connector: string): any {
      return this.connectors[connector]
    }
  }
})

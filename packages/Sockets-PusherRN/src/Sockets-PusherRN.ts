import stampit from '@stamp/it'
import Pusher from './Connectors/Pusher'

export default stampit({
  init({ connector }: { connector: string }) {
    this.default = connector || this.default
  },
  methods: {
    connector(params: object): any {
      return this.getConnector(this.default)(params)
    },
    getConnector(connector: string): any {
      return this.connectors[connector]
    }
  },
  properties: {
    connectors: {
      Pusher
    },
    default: 'Pusher'
  }
})

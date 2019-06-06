import stampit from '@stamp/it'
import Pusher from './Connectors/Pusher'

export default stampit({
  init({ connector }: { connector: string }) {
    this.default = connector || this.default
  },
  properties: {
    default: 'Pusher',
    connectors: {
      Pusher
    }
  },
  methods: {
    getConnector(connector: string): any {
      return this.connectors[connector]
    },
    connector(params: object): any {
      return this.getConnector(this.default)(params)
    }
  }
})

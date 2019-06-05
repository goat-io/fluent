import stampit from "@stamp/it"
import Pusher from "./Connectors/Pusher"

export default stampit({
  init({ connector }) {
    this.default = connector || this.default
  },
  properties: {
    default: "Pusher",
    connectors: {
      Pusher
    }
  },
  methods: {
    getConnector(connector) {
      return this.connectors[connector]
    },
    connector(params) {
      return this.getConnector(this.default)(params)
    }
  }
})
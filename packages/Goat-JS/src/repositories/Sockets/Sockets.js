import stampit from "@stamp/it";
import Pusher from "./Connectors/Pusher";

export default stampit({
  properties: {
    default: "Pusher",
    connectors: {
      Pusher
    }
  },
  methods: {
    getConnector(connector) {
      return this.connectors[connector]();
    },
    connector(connectorName) {
      if (!connectorName) return this.getConnector(this.default);

      return this.getConnector(connectorName);
    }
  }
});

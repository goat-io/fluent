import { Fluent } from "../fluent";

export default Fluent.model({
  properties: {
    name: undefined,
    remoteConnection: undefined,
  },
  methods: {
    table({ name, remoteConnection }) {
      this.name = name;
      this.config = {
        remote: remoteConnection,
      };
      return this;
    },
  },
})();

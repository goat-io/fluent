import stampit from "@stamp/it";
import Model from "./Model";
import Collection from "./Collection";

const Fluent = stampit({
  init() {
    this.registerGlobalVariable();
  },
  properties: {},
  methods: {
    model(...args) {
      this.registerModel(args);
      return Model.compose(...args);
    },
    extend(...args) {
      this.registerModel(args);
      return Model.compose(...args);
    },
    compose(...args) {
      this.registerModel(args);
      return Model.compose(...args);
    },
    collect(args) {
      return Collection(args);
    },
    registerGlobalVariable() {
      if (typeof window !== "undefined" && window && !window._FLUENT_) {
        window._FLUENT_ = {
          connectors: {},
          models: {}
        };
      }

      if (global && !global._FLUENT_) {
        global._FLUENT_ = {
          connectors: {},
          models: {}
        };
      }
    },
    registerModel(args) {
      let name =
        args && args[0] && args[0].properties && args[0].properties.name
          ? args[0].properties.name
          : undefined;

      if (!name || name === "baseModel") {
        return;
      }

      if (!(typeof name === "string")) {
        throw new Error(
          "You must assign a name to your Model when using Fluent.compose"
        );
      }

      if (typeof window !== "undefined") {
        window._FLUENT_.models[name] = true;
        return;
      }
      global._FLUENT_.models[name] = true;
    },
    config({
      REMOTE_CONNECTORS = undefined,
      LOCAL_CONNECTORS = undefined,
      MERGE_CONNECTORS = undefined
    }) {
      if (typeof window !== "undefined" && window) {
        window._FLUENT_.connectors = {
          local: LOCAL_CONNECTORS,
          remote: REMOTE_CONNECTORS,
          merge: MERGE_CONNECTORS
        };
      }

      if (typeof global !== "undefined" && global) {
        global._FLUENT_.connectors = {
          local: LOCAL_CONNECTORS,
          remote: REMOTE_CONNECTORS,
          merge: MERGE_CONNECTORS
        };
      }
    },
    getConfig() {
      if (typeof window !== "undefined" && window) {
        return window._FLUENT_;
      }

      if (typeof global !== "undefined" && global) {
        return global._FLUENT_;
      }
    }
  }
})();

export default Fluent;

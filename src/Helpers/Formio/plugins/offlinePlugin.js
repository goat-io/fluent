import GetRequest from './getRequest';

const OFFLINE_PLUGIN = class {
  static get () {
    let plugin = {
      priority: 0,
      preRequest: async (args) => {
        if (args.method === 'GET') {
          return GetRequest.handle(args);
        }
      },
      request: async (args) => {
        if (args.method === 'GET') {
          return GetRequest.handle(args);
        }
      },
      staticRequest: async (args) => {
        if (args.method === 'GET') {
          return GetRequest.handle(args);
        }
      }
    };

    return plugin;
  }
};

export default OFFLINE_PLUGIN;

import Pusher from 'pusher-js';
import SocketsInterface from '../SocketsInterface';

export default SocketsInterface.compose({
  init({ appKey, appCluster }) {
    this.credentials.appKey = appKey || this.credentials.appKey;
    this.credentials.appCluster = appCluster || this.credentials.appCluster;
    this.instance = new Pusher(this.credentials.appKey, {
      cluster: this.credentials.appCluster
    });
  },
  properties: {
    credentials: {
      appKey: 'e308a51cf17ec0881980',
      appCluster: 'us2'
    },
    instance: undefined
  },
  methods: {
    subscribe(channel) {
      try {
        return this.instance.subscribe(channel);
      } catch(error) {
        throw new Error(`Could not connect to channel ${channel}`, error);
      }
    },
    bind(channel, event, callback) {
      if (typeof callback !== 'function') throw new Error('Callback must be a function.');
      this.subscribe(channel).bind(event, callback);
    }
  }
});
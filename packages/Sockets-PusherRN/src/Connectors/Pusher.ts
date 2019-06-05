import { SocketsInterface, Auth } from '@goatlab/goatjs';
import Pusher from 'pusher-js/react-native';

export default SocketsInterface.compose({
  init({ appKey, appCluster, authEndpoint, token }) {
    this.credentials.appKey = appKey || this.credentials.appKey;
    this.credentials.appCluster = appCluster || this.credentials.appCluster;
    this.authEndpoint = authEndpoint || this.authEndpoint;
    const jwt_token = token || Auth().connector().user().x_jwt_token;
    this.instance = new Pusher(this.credentials.appKey, {
      cluster: this.credentials.appCluster,
      authEndpoint: this.authEndpoint,
      auth: {
        headers: {
          Authorization: `Bearer ${jwt_token}`
        }
      }
    });
  },
  properties: {
    credentials: {
      appKey: undefined,
      appCluster: undefined
    },
    channels: {
      here: 'pusher:subscription_succeded',
      error: 'pusher:subscription_error',
      entering: 'pusher:member_added',
      leaving: 'pusher:member_removed'
    },
    authEndpoint: undefined,
    instance: undefined,
    channel: undefined
  },
  methods: {
    join(channel) {
      this.channel = this.instance.subscribe(`presence-${channel}`);
      return this;
    },
    here(callback) {
      if (typeof callback !== 'function') throw new Error('Callback must be a function.');
      this.channel.bind(this.channels.error, (err) => {
        throw new Error(`Could not subscribe to channel: ${err}`);
      });
      return this;
    },
    joining(callback) {
      if (typeof callback !== 'function') throw new Error('Callback must be a function.');
      this.channel.bind(this.channels.entering, callback);
      return this;
    },
    leaving(callback) {
      if (typeof callback !== 'function') throw new Error('Callback must be a function.');
      this.channel.bind(this.channels.leaving, callback);
      return this;
    },
  }
});
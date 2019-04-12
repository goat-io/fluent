import Event from './Event';
import Promise from 'bluebird';
import axios from 'axios';
/* eslint-disable no-unused-vars */
let Connection = (() => {
  let online = (typeof window !== 'undefined') && window && window.navigator ? window.navigator.onLine : true;

  function setOnline() {
    if (!online) {
      online = true;
      Event.emit({
        name: 'FAST:CONNECTION:ONLINE',
        data: online,
        text: 'Application is now online'
      });
    }
  }

  function setOffline() {
    if (online) {
      online = false;
      Event.emit({
        name: 'FAST:CONNECTION:OFFLINE',
        data: online,
        text: 'Application is now offline'
      });
    }
  }

  /**
   * [status description]
   * @return {Promise} [description]
   */
  function initEventListeners() {
    Event.listen({
      name: 'online',
      callback: function () {
        console.log('App is now online');
        setOnline();
      }
    });
    Event.listen({
      name: 'offline',
      callback: function () {
        console.log('App is now offline');
        setOffline();
      }
    });
  }

  function isOnline() {
    return new Promise((resolve, reject) => {
      axios.get('https://yesno.wtf/api')
        .then( res => {
          resolve(true);
        })
        .catch( err => {
          resolve(false);
        })
    });
  }

  return Object.freeze({
    isOnline,
    initEventListeners
  });
})();

export default Connection;

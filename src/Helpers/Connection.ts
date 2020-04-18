import axios from 'axios'
import { Event } from './Event'

export const Connection = (() => {
  let online = typeof window !== 'undefined' && window && window.navigator ? window.navigator.onLine : true

  function setOnline() {
    if (!online) {
      online = true
      Event.emit({
        data: online,
        name: 'GOAT:CONNECTION:ONLINE',
        text: 'Application is now online'
      })
    }
  }

  function setOffline() {
    if (online) {
      online = false
      Event.emit({
        data: online,
        name: 'GOAT:CONNECTION:OFFLINE',
        text: 'Application is now offline'
      })
    }
  }

  /**
   * [status description]
   * @return {Promise} [description]
   */
  function initEventListeners() {
    Event.listen({
      callback: () => {
        console.log('App is now online')
        setOnline()
      },
      name: 'online'
    })
    Event.listen({
      callback: () => {
        console.log('App is now offline')
        setOffline()
      },
      name: 'offline'
    })
  }

  function isOnline() {
    return new Promise((resolve, reject) => {
      axios
        .get('https://yesno.wtf/api')
        .then(res => {
          resolve(true)
        })
        .catch(err => {
          resolve(false)
        })
    })
  }

  return Object.freeze({
    initEventListeners,
    isOnline
  })
})()

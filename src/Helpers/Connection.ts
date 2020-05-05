import { Event } from './Event'

export enum status {
  online = 'GOAT:CONNECTION:ONLINE',
  offline = 'GOAT:CONNECTION:OFFLINE'
}

export const Connection = (() => {
  let online = typeof window !== 'undefined' && window && window.navigator ? window.navigator.onLine : true

  const setOnline = () => {
    if (!online) {
      online = true
      Event.emit(status.online, {
        data: online,

        text: 'Application is now online'
      })
    }
  }

  const setOffline = () => {
    if (online) {
      online = false
      Event.emit(status.offline, {
        data: online,
        text: 'Application is now offline'
      })
    }
  }

  /**
   * [status description]
   * @return {Promise} [description]
   */
  const listen = () => {
    Event.listen('online', setOnline)

    Event.listen('offline', setOffline)
  }

  const removeListeners = () => {
    Event.remove('online', setOnline)
    Event.remove('offline', setOffline)
  }

  const isOnline = (fileUrl?: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      return resolve(true)
      const xhr = new XMLHttpRequest()
      const file =
        fileUrl ||
        'https://www.google.com/logos/doodles/2020/stay-and-play-at-home-with-popular-past-google-doodles-loteria-2019-6753651837108772-s.png'
      const randomNum = Math.round(Math.random() * 10000)

      xhr.open('HEAD', file + '?rand=' + randomNum, true)
      xhr.send()

      const processRequest = (e) => {
        if (xhr.readyState == 4) {
          if (xhr.status >= 200 && xhr.status < 304) {
            return resolve(true)
          } else {
            return resolve(false)
          }
        }
      }

      xhr.addEventListener('readystatechange', processRequest, false)
    })
  }

  return Object.freeze({
    listen,
    removeListeners,
    isOnline,
    status
  })
})()

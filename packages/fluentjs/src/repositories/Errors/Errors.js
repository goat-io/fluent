import axios from 'axios'
import Event from '../../Wrappers/Event'

let ErrorHandler = (() => {
  const parse = async error => {
    switch (error.response && error.response.status) {
      case 400:
        console.log('Bad request')
        Event.emit({
          name: 'GOAT:SESSION:BADREQUEST',
          data: error,
          text: 'Bad request'
        })
        break
      case 440:
        Event.emit({
          name: 'GOAT:SESSION:EXPIRED',
          data: error,
          text: 'Session Expired'
        })
        break
      default:
        throw error
        break
    }
  }
  const interceptAxios = () => {
    axios.interceptors.response.use(
      response => response,
      async error => {
        await parse(error)
        return Promise.reject(error)
      }
    )
  }
  return Object.freeze({
    interceptAxios
  })
})()

export default ErrorHandler

import axios from 'axios'
import * as AxiosLogger from 'axios-logger'
import { Log } from '../Log/Logger'

const instance = axios.create()

const configuration = {
  status: true,
  headers: false
}

instance.interceptors.request.use(
  request => {
    return AxiosLogger.requestLogger(request, {
      ...configuration,
      logger: log => {
        Log.info(log)
      }
    })
  },
  err => {
    return AxiosLogger.errorLogger(err, {
      ...configuration,
      logger: log => {
        Log.error(log)
      }
    })
  }
)

instance.interceptors.response.use(
  request => {
    return AxiosLogger.responseLogger(request, {
      ...configuration,
      logger: log => {
        Log.info(log)
      }
    })
  },
  err => {
    return AxiosLogger.errorLogger(err, {
      ...configuration,
      logger: log => {
        Log.error(log)
      }
    })
  }
)

export const Axios = (() => {
  return instance
})()

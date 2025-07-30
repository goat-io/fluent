import { Fluent, MergeConnector } from './fluent'
import Configuration from './models/Configuration'
import Form from './models/Form'
import Pages from './models/Pages'
import Roles from './models/Role'
import Translation from './models/Translation'
import formio from './plugins/formio'
import loki from './plugins/loki'
import loopback from './plugins/loopback'
import SyncInterval from './repositories/Database/SyncInterval'
import ErrorHandler from './repositories/Errors/Errors'
import Utilities from './utilities'

/* eslint-disable no-unused-vars */
const GOAT = (() => {
  /**
   * Loads all configuration for the GOAT app
   * This is the main start function and mandatory
   * to execute if you will use it!
   *
   * @param {*} conf
   * @param {*} conf.appConf Configuration of the App
   */
  async function start({ appConf, forceOnline }) {
    ErrorHandler.interceptAxios()
    if (!forceOnline) {
      await Fluent.config({
        REMOTE_CONNECTORS: [
          {
            default: true,
            name: 'formio',
            baseUrl: appConf.fluentFormioBaseUrl,
            connector: formio
          },
          {
            name: 'loopback',
            baseUrl: appConf.loopbackBaseUrl,
            connector: loopback
          }
        ],
        LOCAL_CONNECTORS: [
          {
            name: 'loki',
            connector: loki,
            default: true
          }
        ],
        MERGE_CONNECTORS: [
          {
            default: true,
            name: 'formioLoki',
            connector: MergeConnector
          }
        ]
      })
      SyncInterval.set(3000)
    }
    const config = await Configuration.set({ appConf })
    const promises = [
      Roles.set({ appConf, forceOnline }),
      Pages.set({ appConf, forceOnline }),
      Form.set({ appConf, forceOnline }),
      Translation.set({ appConf, forceOnline })
    ]

    const results = await Promise.all(promises)

    const appTranslations = results[3]

    return {
      config: config,
      translations: appTranslations,
      defaultLanguage: Utilities.getLanguage()
    }
  }
  /**
   *
   * Triggers a full Online update of all Configuration,
   * Forms, Pages and Roles of the application
   *
   * @param {Object} conf
   * @param {Object} conf.appConf Configuration of the App
   * @returns
   */
  async function sync({ appConf }) {
    return start({ appConf, forceOnline: true })
  }

  return Object.freeze({
    start,
    sync
  })
})()

export default GOAT

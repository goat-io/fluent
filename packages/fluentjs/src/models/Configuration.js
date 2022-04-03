import { Fluent } from '../fluent'
import Utilities from '../utilities'
import dayjs from 'dayjs'
// TODO We still have to figure out how to solve the problem of
// The CONFIG URL and FLUENT_URL changing on APP sync
// Every page refresh will make the urls go back to their default
export default Fluent.model({
  properties: {
    name: 'Configuration',
    config: {
      remote: {
        connector: 'formioConfig',
        token: ''
      }
    }
  },
  methods: {
    /**
     * Decides whether to set Configurations
     * Online or Offline
     * @param {Object} config.appConfig The application Config
     * @param {Boolean} config.forceOnline If we need online
     */
    async set({ appConf, forceOnline }) {
      if (!forceOnline) {
        return this.setOffline({ appConf })
      }
      return this.setOnline({ appConf })
    },
    /**
     *
     * @param {*} param0
     */
    async setOffline({ appConf }) {
      let localConfig = await this.local().first()

      let localConfigDate = this.getConfigDate(localConfig)
      let offlineConfigDate = appConf.offlineFiles.lastUpdated.date

      // If local config is newer than offline
      if (localConfigDate > offlineConfigDate) {
        return localConfig
      }

      if (localConfig) {
        await this.local().clear({ sure: true })
      }

      return this.local().insert({
        ...appConf.offlineFiles.Configuration.data,
        fastUpdated: dayjs().unix()
      })
    },
    /**
     *
     * @param {*} param0
     */
    async setOnline({ appConf }) {
      let localConfig = await this.local().first()

      let remoteConfig = await this.remote().first()

      if (!localConfig && !remoteConfig) {
        throw new Error(
          'Application is not connected to internet, or the configuration file cannot be pulled'
        )
      }

      if (!remoteConfig) {
        return localConfig
      }

      if (localConfig) {
        await this.local().clear({ sure: true })
      }
      return this.local().insert({
        ...remoteConfig.data,
        fastUpdated: dayjs().unix()
      })
    },
    /**
     *
     * @param {*} config
     */
    getConfigDate(config) {
      return Utilities.get(() => config.fastUpdated, 0)
    }
  }
})()

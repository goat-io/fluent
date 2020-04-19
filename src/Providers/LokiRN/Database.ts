import Loki from 'lokijs'
import { AsyncStorage } from 'react-native'

const TAG = '[LokiReactNativeAsyncStorageAdapter]'
class LokiReactNativeAsyncStorageAdapter {
  private options
  constructor(options: any = {}) {
    this.options = options
  }
  public loadDatabase(dbname: any, callback: any) {
    //console.log(TAG, "loading database");
    AsyncStorage.getItem(dbname, (error, result) => {
      if (error) {
        console.error(TAG, 'loadDatabase', error)
      } else {
        if (result == null) {
          //console.warn(TAG, "couldn't find database");
          callback(null)
        } else {
          callback(result)
        }
      }
    })
  }
  public saveDatabase(dbname, dbstring, callback) {
    //console.log(TAG, "saving database");
    AsyncStorage.setItem(dbname, dbstring, error => {
      if (error) {
        console.error(TAG, 'saveDatabase', error)
      } else {
        callback()
      }
    })
  }

  public deleteDatabase(dbname, callback) {
    AsyncStorage.removeItem(dbname, error => {
      if (!error) {
        callback()
      } else {
        console.error(TAG, 'deleteDatabase', error)
      }
    })
  }
}

let DB = null
export const Database = (() => {
  /*
  |--------------------------------------------------------------------------
  | LockiDB Config
  |--------------------------------------------------------------------------
  | Configuration for the Local DB creation.
  |
  */
  const getModels = () => {
    const models =
      typeof window !== 'undefined' && window && window._FLUENT_ && window._FLUENT_.models
        ? window._FLUENT_.models
        : global && global._FLUENT_ && global._FLUENT_.models
        ? global._FLUENT_.models
        : {}
    return models
  }
  /**
   *
   *
   * @param {Object} configuration- The configuration for the DB
   * @param {string} configuration.env - Environment i.e 'production'
   * @returns
   */
  const _create = () => {
    return new Promise(resolve => {
      let idbAdapter: any
      let pa: any
      let db: any

      const dbConfig = {
        autoload: true,
        autoloadCallback: databaseInitialize,
        autosave: true,
        autosaveInterval: 1000,
        throttledSaves: false
      }

      try {
        db = new Loki('GOAT', { ...dbConfig, adapter: new LokiReactNativeAsyncStorageAdapter() })
      } catch (error) {
        db = new Loki('GOAT', dbConfig)
      }

      function databaseInitialize() {
        const baseModels = getModels()
        if (!baseModels) {
          throw new Error(
            'Cannot Start FLUENT, no models registered or you dont have access to the "window" or "global" variable'
          )
        }

        Object.keys(baseModels).forEach(model => {
          const dbModel = db.getCollection(model)

          if (!dbModel) {
            db.addCollection(model)
          }
        })
        resolve(db)
      }
    })
  }
  /**
   * Checks if the DB is created or if new
   * Models need to be added to the DB
   * @returns {Boolean}
   */
  const shouldCreate = () => {
    const windowModels = getModels()
    const dbModels = DB.collections.reduce((acc, collection) => {
      acc.push(collection.name)
      return acc
    }, [])

    const models = []
    Object.keys(windowModels).forEach(m => {
      if (!dbModels.includes(m)) {
        models.push(m)
      }
    })

    return models
  }
  /**
   *
   *
   * @export
   * @param {Object} configuration- The configuration for the DB
   * @param {string} configuration.env - Environment i.e 'production'
   * @returns
   */
  const get = async () => {
    if (!DB) {
      DB = await _create()
    }
    const recreateModels = shouldCreate()
    if (recreateModels.length > 0) {
      recreateModels.forEach(model => {
        DB.addCollection(model)
      })
    }
    return DB
  }

  return Object.freeze({
    get
  })
})()

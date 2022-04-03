import Loki from 'lokijs'
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'

interface _FLUENT_ {
  models?: {
    [key: string]: boolean
  }
}

declare global {
  interface Window {
    _FLUENT_: _FLUENT_
  }
  namespace NodeJS {
    interface Global {
      _FLUENT_: _FLUENT_
    }
  }
}

let DB = null
export const Database = (() => {
  /*
  |--------------------------------------------------------------------------
  | LokiDB Config
  |--------------------------------------------------------------------------
  | Configuration for the Local DB creation.
  |
  */
  const getModels = () => {
    const models =
      typeof window !== 'undefined' &&
      window &&
      window._FLUENT_ &&
      window._FLUENT_.models
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
  const _create = () =>
    new Promise(resolve => {
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
        idbAdapter = new LokiIndexedAdapter('GOAT')
        pa = new Loki.LokiPartitioningAdapter(idbAdapter, {
          paging: true
        })

        db = new Loki('GOAT', { ...dbConfig, adapter: pa })
      } catch (error) {
        db = new Loki('GOAT', dbConfig)
      }

      function databaseInitialize() {
        const baseModels = getModels()
        if (!baseModels) {
          throw new Error(
            'Cannot Start FLUENT, no models registered or you don`t have access to the "window" or "global" variable'
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

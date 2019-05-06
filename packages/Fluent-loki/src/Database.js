// import Promise from "bluebird";
import Loki from "lokijs";
import LokiIndexedAdapter from "lokijs/src/loki-indexed-adapter";
var DB = null;
let Database = (() => {
  /*
  |--------------------------------------------------------------------------
  | LockiDB Config
  |--------------------------------------------------------------------------
  | Configuration for the Local DB creation.
  |
  */
  const getModels = () => {
    const models =
      typeof window !== "undefined" &&
      window &&
      window._FLUENT_ &&
      window._FLUENT_.models
        ? window._FLUENT_.models
        : global && global._FLUENT_ && global._FLUENT_.models
        ? global._FLUENT_.models
        : undefined;
    return models;
  };
  /**
   *
   *
   * @param {Object} configuration- The configuration for the DB
   * @param {string} configuration.env - Environment i.e 'production'
   * @returns
   */
  const _create = () => {
    return new Promise(resolve => {
      let idbAdapter;
      let pa;
      let db;

      let dbConfig = {
        autosave: true,
        autosaveInterval: 1000,
        autoload: true,
        /* eslint-disable no-use-before-define */
        autoloadCallback: databaseInitialize,
        throttledSaves: false
      };

      try {
        idbAdapter = new LokiIndexedAdapter("GOAT");
        pa = new Loki.LokiPartitioningAdapter(idbAdapter, {
          paging: true
        });

        db = new Loki("GOAT", { ...dbConfig, adapter: pa });
      } catch (error) {
        db = new Loki("GOAT", dbConfig);
      }

      function databaseInitialize() {
        const baseModels = getModels();
        if (!baseModels) {
          throw new Error(
            'Cannot Start FLUENT, no models registered or you dont have access to the "window" or "global" variable'
          );
        }

        Object.keys(baseModels).forEach(model => {
          const dbModel = db.getCollection(model);

          if (!dbModel) {
            db.addCollection(model);
          }
        });
        resolve(db);
      }
    });
  };
  /**
   * Checks if the DB is created or if new
   * Models need to be added to the DB
   * @returns {Boolean}
   */
  const shouldCreate = () => {
    const windowModels = getModels();
    const dbModels = DB.collections.reduce((acc, collection) => {
      acc.push(collection.name);
      return acc;
    }, []);

    let models = [];
    Object.keys(windowModels).forEach(m => {
      if (!dbModels.includes(m)) {
        models.push(m);
      }
    });

    return models;
  };
  /**
   *
   *
   * @export
   * @param {Object} configuration- The configuration for the DB
   * @param {string} configuration.env - Environment i.e 'production'
   * @returns
   */
  const get = async function() {
    if (!DB) {
      DB = await _create();
    }
    const recreateModels = shouldCreate();
    if (recreateModels.length > 0) {
      recreateModels.forEach(model => {
        DB.addCollection(model);
      });
    }
    return DB;
  };

  return Object.freeze({
    get
  });
})();

export default Database;

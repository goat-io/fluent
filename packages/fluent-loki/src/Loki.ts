import LokiJS from 'lokijs'
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'
import lfsa from 'lokijs/src/loki-fs-structured-adapter'
import cryptedFile from 'lokijs/src/loki-crypted-file-adapter'
import LokiNativescriptAdapter from 'lokijs/src/loki-nativescript-adapter'

export enum LokiStorageType {
  indexedDB = 'indexedDB',
  memory = 'memory',
  fsStructured = 'fsStructured',
  file = 'file',
  cryptedFile = 'cryptedFile',
  json = 'json'
}

export type LokiParams = {
  dbName: string
  storage: LokiStorageType
  secret?: string
}

// TODO: fix this interface to make secret optional if not crypted
export type LokiCreateParams<T extends LokiParams> = T extends {
  storage: LokiStorageType.cryptedFile
}
  ? {
      secret: string
    } & LokiParams
  : LokiParams

export class LokiClass {
  public createDb<T extends LokiParams>({
    dbName,
    storage,
    secret
  }: LokiCreateParams<T>): LokiJS {
    const dbConfig = {
      autoload: true,
      autosave: true,
      autosaveInterval: 1000,
      throttledSaves: false
    }

    switch (storage) {
      case LokiStorageType.indexedDB:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiIndexedAdapter(dbName),
            {
              paging: true
            }
          )
        })
      case LokiStorageType.file:
        return new LokiJS(dbName, dbConfig)
      case LokiStorageType.memory:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiJS.LokiMemoryAdapter({
              asyncResponses: true,
              asyncTimeout: 50
            })
          )
        })
      case LokiStorageType.fsStructured:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new lfsa()
        })
      case LokiStorageType.cryptedFile:
        cryptedFile.setSecret(secret)
        return new LokiJS(dbName, { ...dbConfig, adapter: cryptedFile })
      case LokiStorageType.json:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiNativescriptAdapter()
        })

      default:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiJS.LokiMemoryAdapter()
          )
        })
    }
  }
}

export const Loki = new LokiClass()

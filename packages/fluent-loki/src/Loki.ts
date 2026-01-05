import LokiJS from 'lokijs'
import cryptedFile from 'lokijs/src/loki-crypted-file-adapter'
import lfsa from 'lokijs/src/loki-fs-structured-adapter'
import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter'
import LokiNativescriptAdapter from 'lokijs/src/loki-nativescript-adapter'

export enum LokiStorageType {
  IndexedDB = 'indexedDB',
  Memory = 'memory',
  FsStructured = 'fsStructured',
  File = 'file',
  CryptedFile = 'cryptedFile',
  Json = 'json',
}

export type LokiParams = {
  dbName: string
  storage: LokiStorageType
  secret?: string
}

// TODO: fix this interface to make secret optional if not crypted
export type LokiCreateParams<T extends LokiParams> = T extends {
  storage: LokiStorageType.CryptedFile
}
  ? {
      secret: string
    } & LokiParams
  : LokiParams

export class LokiClass {
  public createDb<T extends LokiParams>({
    dbName,
    storage,
    secret,
  }: LokiCreateParams<T>): LokiJS {
    const dbConfig = {
      autoload: true,
      autosave: true,
      autosaveInterval: 1000,
      throttledSaves: false,
    }

    switch (storage) {
      case LokiStorageType.IndexedDB:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiIndexedAdapter(dbName),
            {
              paging: true,
            },
          ),
        })
      case LokiStorageType.File:
        return new LokiJS(dbName, dbConfig)
      case LokiStorageType.Memory:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiJS.LokiMemoryAdapter({
              asyncResponses: true,
              asyncTimeout: 50,
            }),
          ),
        })
      case LokiStorageType.FsStructured:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new lfsa(),
        })
      case LokiStorageType.CryptedFile:
        cryptedFile.setSecret(secret)
        return new LokiJS(dbName, { ...dbConfig, adapter: cryptedFile })
      case LokiStorageType.Json:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiNativescriptAdapter(),
        })

      default:
        return new LokiJS(dbName, {
          ...dbConfig,
          adapter: new LokiJS.LokiPartitioningAdapter(
            new LokiJS.LokiMemoryAdapter(),
          ),
        })
    }
  }
}

export const Loki = new LokiClass()

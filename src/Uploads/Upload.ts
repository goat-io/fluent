import { Request, RequestHandler, Response } from 'express'
import { existsSync, mkdirSync } from 'fs'
import * as multer from 'multer'
import { extname } from 'path'
// import { Azure } from './Providers/Azure'
import { Google } from './Providers/Google'
import { S3 } from './Providers/S3'

export enum Providers {
  Memory = 'memory',
  Google = 'google',
  S3 = 's3',
  Azure = 'azure',
  Local = 'local'
}

export interface MulterConfiguration {
  fileName?: string
  folder: string
  fileKey?: string
  maxFileSize?: number
}

export class Upload {
  private storageProvider: Providers
  private request: Request
  private response: Response
  constructor(provider: Providers, request: Request, response: Response) {
    this.storageProvider = provider
    this.request = request
    this.response = response
  }

  public file = async (config: MulterConfiguration) => {
    const upload = this.getStorage(config)
    return new Promise<object>((resolve, reject) => {
      upload(this.request, this.response, err => {
        if (err) {
          reject(err)
        } else {
          resolve(this.request.files[0])
        }
      })
    })
  }
  /**
   *
   */
  private getStorage = (config: MulterConfiguration): RequestHandler => {
    const limits = { fileSize: config.maxFileSize || 50 * 1024 * 1024 }
    const key = config.fileKey || 'file'
    config.fileName = config.fileName || Date.now() + '-'
    let storage: multer.StorageEngine

    switch (this.storageProvider) {
      case Providers.Memory:
        storage = multer.memoryStorage()
        break
      case Providers.S3:
        storage = S3(config)
        break
      //  case Providers.Azure:
      //  storage = Azure(config)
      //  break
      case Providers.Google:
        storage = Google(config)
        break
      case Providers.Local:
        const folderPath = `${__dirname}/${config.folder}`

        if (!existsSync(folderPath)) {
          mkdirSync(folderPath)
        }

        storage = multer.diskStorage({
          destination(req, file, cb) {
            cb(null, folderPath)
          },
          filename(req, file, cb) {
            cb(null, config.fileName + extname(file.originalname))
          }
        })
        break
      default:
        storage = multer.memoryStorage()
        break
    }

    return multer.default({ storage, limits }).array(key, 1)
  }
}

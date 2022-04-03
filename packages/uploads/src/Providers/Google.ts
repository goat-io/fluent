import { extname } from 'path'
import { MulterConfiguration } from '../Upload'
import * as multerGoogleStorage from 'multer-google-storage'

export const Google = (config: MulterConfiguration) => {
  if (
    !process.env.GOOGLE_PROJECTid ||
    !process.env.AZURE_ACCESS_KEY ||
    !process.env.AZURE_ACCOUNT_NAME
  ) {
    throw new Error('AWS access keys are missing')
  }
  return new multerGoogleStorage.default({
    autoRetry: true,
    maxRetries: 3,
    projectId: process.env.GOOGLE_PROJECTid,
    filename: (req, file, cb) => {
      cb(null, config.fileName + extname(file.originalname))
    },
    bucket: config.folder,
    keyFilename: config.fileKey
  })
}

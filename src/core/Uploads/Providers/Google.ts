const multerGoogleStorage = require('multer-google-storage')
import { extname } from 'path'
import { MulterConfiguration } from '../Upload'

export const Google = (config: MulterConfiguration) => {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.AZURE_ACCESS_KEY || !process.env.AZURE_ACCOUNT_NAME) {
    throw new Error('AWS access keys are missing')
  }
  return new multerGoogleStorage({
    autoRetry: true,
    maxRetries: 3,
    projectId: process.env.GOOGLE_PROJECT_ID,
    filename: (req, file, cb) => {
      cb(null, config.fileName + extname(file.originalname))
    },
    bucket: config.folder,
    keyFilename: config.fileKey
  })
}

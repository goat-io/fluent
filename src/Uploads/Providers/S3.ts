import * as AWS from 'aws-sdk'
import multerS3 from 'multer-s3'
import { MulterConfiguration } from '../Upload'
import { extname } from 'path'

const s3 = new AWS.S3()
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYid,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

export const S3 = (config: MulterConfiguration) => {
  if (!process.env.AWS_ACCESS_KEYid || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS access keys are missing')
  }
  return multerS3({
    acl: 'public-read',
    bucket: config.folder,
    key: (request, file, cb) => {
      cb(null, config.fileName + extname(file.originalname))
    },
    s3
  })
}

/*import { MulterAzureStorage } from 'multer-azure-blob-storage'
import { extname } from 'path'
import { MulterConfiguration } from '../Upload'

export const Azure = (config: MulterConfiguration) => {
  if (!process.env.AZURE_CONNECTION_STRING || !process.env.AZURE_ACCESS_KEY || !process.env.AZURE_ACCOUNT_NAME) {
    throw new Error('AWS access keys are missing')
  }
  return new MulterAzureStorage({
    accessKey: process.env.AZURE_ACCESS_KEY,
    accountName: process.env.AZURE_ACCOUNT_NAME,
    blobName: (req: any, file: Express.Multer.File): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        resolve(config.fileName + extname(file.originalname))
      })
    },
    connectionString: process.env.AZURE_CONNECTION_STRING,
    containerAccessLevel: 'blob',
    containerName: config.folder,
    urlExpirationTime: 60
  })
}*/

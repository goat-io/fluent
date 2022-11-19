import { MulterAzureStorage, MASNameResolver } from 'multer-azure-blob-storage'
import { extname } from 'path'
import { MulterConfiguration } from '../Upload'

export const Azure = (config: MulterConfiguration) => {
  if (
    !process.env['AZURE_CONNECTION_STRING'] ||
    !process.env['AZURE_ACCESS_KEY'] ||
    !process.env['AZURE_ACCOUNT_NAME']
  ) {
    throw new Error('Azure access keys are missing')
  }

  const resolveBlobName: MASNameResolver = (
    req: any,
    file: any
  ): Promise<string> =>
    new Promise<string>((resolve, reject) =>
      resolve(config.fileName + extname(file.originalname))
    )

  return new MulterAzureStorage({
    accessKey: process.env['AZURE_ACCESS_KEY'],
    accountName: process.env['AZURE_ACCOUNT_NAME'],
    blobName: resolveBlobName,
    connectionString: process.env['AZURE_CONNECTION_STRING'],
    containerAccessLevel: 'blob',
    containerName: config.folder,
    urlExpirationTime: 60
  })
}

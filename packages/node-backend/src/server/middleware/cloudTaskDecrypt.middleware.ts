import { CommonLogger } from '@goatlab/js-utils'
import { Security } from '@goatlab/node-utils'
import type { NextFunction, Request, Response } from 'express'

export const useCloudTaskDecryptMiddleware = ({
  getLogger = () => console,
  getEncryptionKey,
}: {
  getEncryptionKey: () => string
  getLogger?: () => CommonLogger
}) => {
  const cloudTaskDecryptMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const logger = getLogger()
    const isLocalTest = req.headers['local-queue'] === 'true'
    const base64String = isLocalTest ? req.body.toString('utf8') : req.body

    try {
      // Parse the body from base64 to ASCII then to JSON
      const body = JSON.parse(
        Buffer.from(base64String, 'base64').toString('ascii'),
      )

      // Decrypt the body
      const decryptedBody = Security.decryptObject(body, getEncryptionKey())

      if (!decryptedBody.content) {
        throw new Error('Invalid or missing content in decrypted body')
      }

      // Assign the parsed content to req.body
      req.body = JSON.parse(decryptedBody.content)
    } catch (err) {
      logger.error(err)
      if (err instanceof Error) {
        res.status(400).json({
          status: 400,
          message: err.message || 'Error processing request',
        })
        return
      }
      res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
      })
      return
    }

    // Call next middleware if no error occurred
    next()
  }

  return cloudTaskDecryptMiddleware
}

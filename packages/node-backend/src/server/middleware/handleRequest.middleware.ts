import type { NextFunction, Request, Response } from 'express'
import type { ZodSchema, z } from 'zod'
import { ZodError } from 'zod'

export const handleRequest = <T extends ZodSchema>(
  schema: T,
  handler: (args: {
    req: Request<any, any, z.infer<T>>
    res: Response
    body: z.infer<T>
  }) => Promise<void>
) => {
  return async (
    req: Request<any, any, any>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Parse and validate request body
      const parsedBody = schema.parse(req.body)

      // Pass the parsed body and other parameters to the handler
      await handler({
        req,
        res,
        body: parsedBody
      })

      // If the response hasn't been sent by the handler, send a default 200 OK
      if (!res.headersSent) {
        return res.status(200).end()
      }

      return next()
    } catch (err) {
      console.log(err)
      // Handle validation errors (Zod)
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: err.issues // Send detailed validation errors
        })
      }

      // Handle other errors and respond with a 500 status code
      return res.status(500).json({
        error: 'Internal Server Error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }
}

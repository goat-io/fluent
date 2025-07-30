import type { NextFunction, Request, Response } from 'express'

export const requireAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isAuthenticated = req.context.user
  if (!isAuthenticated) {
    res.status(401).send('Unauthorized')
    return
  }

  next()
}

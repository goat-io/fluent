import { ExecutionContext, UseGuards, applyDecorators } from '@nestjs/common'

import { ApiBearerAuth } from '@nestjs/swagger'
import { GoatJWTAuthGuard } from './auth.guard'

export const Auth = (() => {
  /**
   *
   * @param spec
   */
  const protect = (...guard): any => {
    if (guard && guard.length > 0) {
      return applyDecorators(
        UseGuards(GoatJWTAuthGuard),
        ApiBearerAuth('token'),
        UseGuards(...guard)
      )
    }
    return applyDecorators(UseGuards(GoatJWTAuthGuard), ApiBearerAuth('token'))
  }
  /**
   * Gets all basic information to create a Guard
   * and protect a class or route
   */
  const parseContext = (context: ExecutionContext) => {
    const req = context.getArgs()[0].raw
    const url: string = req.url
    const HTTPMethod: string = req.method
    const handlerName = context.getHandler().name
    const user = context.switchToHttp().getRequest().user

    return { req, url, HTTPMethod, handlerName, user }
  }

  return Object.freeze({ protect, parseContext })
})()

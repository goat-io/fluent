import { UseGuards, applyDecorators } from '@nestjs/common'
import { GoatJWTAuthGuard } from './auth.guard'
import { ApiBearerAuth } from '@nestjs/swagger'

export const Auth = (() => {
  /**
   *
   * @param spec
   */
  const authorize = (): MethodDecorator => {
    return applyDecorators(UseGuards(GoatJWTAuthGuard), ApiBearerAuth('token'))
  }

  return Object.freeze({ authorize })
})()

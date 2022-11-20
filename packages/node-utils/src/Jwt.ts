import { AnyObject } from '@goatlab/js-utils'
import {
  JwtPayload,
  sign,
  SignOptions,
  verify as verifyAsync,
  VerifyOptions
} from 'jsonwebtoken'

enum algorithms {
  'HS256' = 'HS256',
  'HS384' = 'HS384',
  'HS512' = 'HS512',
  'RS256' = 'RS256',
  'RS384' = 'RS384',
  'RS512' = 'RS512',
  'PS256' = 'PS256',
  'PS384' = 'PS384',
  'PS512' = 'PS512',
  'ES256' = 'ES256',
  'ES384' = 'ES384',
  'ES512' = 'ES512'
}

// tslint:disable-next-line: interface-name
export interface JwtOptions {
  secret: string
  expiresIn?: string
  algorithm?: algorithms
}

export const Jwt = (() => {
  /**
   * Given a JWT return a userProfile
   * @param token
   */
  const verify = async (
    token: string,
    secret: string,
    options?: VerifyOptions
  ): Promise<AnyObject> => {
    const decoded = (await verifyAsync(
      token,
      secret,
      options
    )) as unknown as AnyObject
    return decoded
  }

  /**
   *
   * @param userProfile
   * https://www.npmjs.com/package/jsonwebtoken
   * @param jwtOptions
   */
  const generate = async (
    payload: AnyObject,
    jwtOptions: SignOptions & { secret: string }
  ): Promise<string> => {
    const secret = jwtOptions.secret
    delete jwtOptions.secret
    return await sign(payload, secret, {
      algorithm: jwtOptions.algorithm || algorithms.HS256,
      ...jwtOptions
    })
  }

  return Object.freeze({ generate, verify })
})()

import { AnyObject } from '@goatlab/js-utils'
import type { SignOptions, VerifyOptions } from 'jsonwebtoken'
import { sign, verify as verifyAsync } from 'jsonwebtoken'

enum Algorithms {
  Hs256 = 'HS256',
  Hs384 = 'HS384',
  Hs512 = 'HS512',
  Rs256 = 'RS256',
  Rs384 = 'RS384',
  Rs512 = 'RS512',
  Ps256 = 'PS256',
  Ps384 = 'PS384',
  Ps512 = 'PS512',
  Es256 = 'ES256',
  Es384 = 'ES384',
  Es512 = 'ES512'
}

// tslint:disable-next-line: interface-name
export interface JwtOptions {
  secret: string
  expiresIn?: string
  algorithm?: Algorithms
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
    const { secret, ...restOptions } = jwtOptions
    return await sign(payload, secret, {
      algorithm: restOptions.algorithm || Algorithms.Hs256,
      ...restOptions
    })
  }

  return Object.freeze({ generate, verify })
})()

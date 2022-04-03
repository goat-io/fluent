import { sign, verify as verifyAsync } from 'jsonwebtoken'
import { Errors } from './Errors'

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
    options?: any
  ): Promise<any> => {
    if (!token) {
      const errors = Errors(null, `Error verifying token : 'token' is null`)
      throw new Error(errors)
    }

    try {
      const decodedToken = await verifyAsync(token, secret, options)
      return decodedToken
    } catch (error) {
      const errors = Errors(error, `Error verifying token : ${error.message}`)
      throw new Error(errors)
    }
  }

  /**
   *
   * @param userProfile
   * https://www.npmjs.com/package/jsonwebtoken
   * @param jwtOptions
   */
  const generate = async (
    payload: any,
    jwtOptions: JwtOptions
  ): Promise<string> => {
    if (!payload) {
      const errors = Errors(
        null,
        'Error generating token : userProfile is null'
      )
      throw new Error(errors)
    }

    let token: string
    try {
      token = await sign(payload, jwtOptions.secret, {
        expiresIn: jwtOptions.expiresIn,
        algorithm: jwtOptions.algorithm || algorithms.HS256
      })
    } catch (error) {
      const errors = Errors(error, `Error encoding token : ${error}`)
      throw new Error(errors)
    }

    return token
  }
  /**
   *
   * Extracts the secret key from the ENV variables
   *
   * @returns {String}
   *
   */
  const getScretFromEnv = () =>
    process.env.JWT_SECRET_BUFFER
      ? Buffer.from(process.env.JWT_SECRET_BUFFER, 'base64')
      : process.env.JWT_SECRET
  /**
   *
   * Given the express APP, it defined a middleware
   * to process the JWT token for LB apps
   *
   * @param {*} app
   */
  const expressMiddleware = app => {
    /* app
      .remotes()
      .phases.addBefore('invoke', 'options-from-request')
      .use(async (ctx, next) => {
        const token = getTokenFromRequest(ctx.req)
        const secret = getScretFromEnv()
        const [tokenError, decoded] = verify({
          token,
          secret
        })
       
        const anonymos = {
          data: {
            email: 'ANONYMOUS',
            name: 'ANONYMOUS'
          },
          id: null
        }
        ctx.args.options = ctx.args.options || {}
        ctx.args.options.token = token
        ctx.args.options.validToken = tokenError ? false : true
        // ctx.args.options.user = tokenError
        //  ? anonymos
        //  : await Auth.getUserById(decoded.user.id, app)
        next()
     
      })
      */
  }
  return Object.freeze({ generate, verify })
})()

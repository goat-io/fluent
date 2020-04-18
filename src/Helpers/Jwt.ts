import { securityId, UserProfile } from '@loopback/security'
import { sign, verify as verifyAsync } from 'jsonwebtoken'
import { Errors } from '../Helpers/Errors'

// tslint:disable-next-line: interface-name
export interface JwtOptions {
  secret: string
  expiresIn: string
}

export const Jwt = (() => {
  /**
   * Given a JWT return a userProfile
   * @param token
   */
  const verify = async (token: string, secret: string): Promise<UserProfile> => {
    if (!token) {
      const errors = Errors(null, `Error verifying token : 'token' is null`)
      throw new Error(errors)
    }

    let userProfile: UserProfile

    try {
      const decodedToken = await verifyAsync(token, secret)

      userProfile = Object.assign(
        { [securityId]: '', name: '' },
        {
          id: decodedToken._id,
          [securityId]: decodedToken._id,
          name: decodedToken.name
        }
      )
    } catch (error) {
      const errors = Errors(error, `Error verifying token : ${error.message}`)
      throw new Error(errors)
    }
    return userProfile
  }

  /**
   *
   * @param userProfile
   * @param jwtOptions
   */
  const generate = async (userProfile: UserProfile, jwtOptions: JwtOptions): Promise<string> => {
    if (!userProfile) {
      const errors = Errors(null, 'Error generating token : userProfile is null')
      throw new Error(errors)
    }

    const userInfoForToken = {
      email: userProfile.email,
      id: userProfile[securityId],
      name: userProfile.name
    }

    let token: string
    try {
      token = await sign(userInfoForToken, jwtOptions.secret, {
        expiresIn: jwtOptions.expiresIn
      })
    } catch (error) {
      const errors = Errors(error, `Error encoding token : ${error}`)
      throw new Error(errors)
    }

    return token
  }
  return Object.freeze({ generate, verify })
})()

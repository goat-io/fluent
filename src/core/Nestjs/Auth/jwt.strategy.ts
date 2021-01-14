import * as admin from 'firebase-admin'

import { FirebaseUser, UNAUTHORIZED } from '@tfarras/nestjs-firebase-auth'

import { ConfigService } from '@nestjs/config'
import { ExtractJwt } from 'passport-jwt'
import { For } from '../../../Helpers/For'
import { Injectable } from '@nestjs/common'
import { Jwt } from '../../../Helpers/Jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-strategy'

@Injectable()
export class GoatStrategy extends PassportStrategy(Strategy, 'jwt') {
  private extractor: ExtractJwt.fromAuthHeaderAsBearerToken
  constructor(private readonly config: ConfigService) {
    super()
    this.extractor = ExtractJwt.fromAuthHeaderAsBearerToken()
  }
  /**
   * Authenticate the JWT either by using Firebase
   * Token, the locally generated, Auth0 (soon)
   * @param req
   */
  async authenticate(req: any): Promise<void> {
    const idToken = this.extractor(req)

    if (!idToken) {
      this.fail(UNAUTHORIZED, 401)
      return
    }

    if (process.env.AUTH_USE_FIREBASE === 'true') {
      const user = this.firebaseValidation(idToken)
      req.user = user
      return
    }

    const [decodeError, decodedToken] = await For.async(
      Jwt.verify(idToken, process.env.AUTH_JWT_SECRET)
    )

    if (decodeError) {
      this.fail(UNAUTHORIZED, 401)
    }

    req.user = decodedToken
    this.success(decodedToken)
  }
  /**
   * Custom logic for token validation
   * @param payload
   */
  async validate(payload: FirebaseUser): Promise<FirebaseUser> {
    // If we need to include additional validations to the token or user
    return payload
  }
  /**
   * Perform token authentication using
   * Google`s JWT token
   * @param idToken
   */
  private async firebaseValidation(idToken: string): Promise<void> {
    const [error, decodedToken] = await For.async(
      admin.auth().verifyIdToken(idToken)
    )

    if (error) {
      this.fail({ error }, 401)
    }

    const [internalError, result] = await For.async(
      this.validateDecodedIdToken(decodedToken)
    )

    if (internalError) {
      this.logger.error(internalError)

      this.fail(internalError, 401)
    }
  }
  /**
   * Wrapper to run any specific functions for
   * validation purposes
   * @param decodedIdToken
   */
  private async validateDecodedIdToken(decodedIdToken: FirebaseUser) {
    const result = await this.validate(decodedIdToken)

    if (result) {
      this.success(result)
    }

    this.fail(UNAUTHORIZED, 401)
  }
}

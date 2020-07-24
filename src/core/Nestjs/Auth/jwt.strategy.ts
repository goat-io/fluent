import * as admin from 'firebase-admin'

import {
  FirebaseAuthStrategy,
  FirebaseUser,
  UNAUTHORIZED
} from '@tfarras/nestjs-firebase-auth'

import { ConfigService } from '@nestjs/config'
import { ExtractJwt } from 'passport-jwt'
import { For } from '../../../Helpers/For'
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-strategy'
import { User } from '../Auth/User/user.entity'

@Injectable()
export class GoatStrategy extends PassportStrategy(Strategy, 'jwt') {
  private extractor: ExtractJwt.fromAuthHeaderAsBearerToken
  constructor(private readonly config: ConfigService) {
    super()
    this.extractor = ExtractJwt.fromAuthHeaderAsBearerToken()
  }
  /**
   * Custom logic for token validation
   * @param payload
   */
  async validate(payload: FirebaseUser): Promise<FirebaseUser> {
    // If we need to include additional validatoins to the token or user
    return payload
  }
  /**
   * Authenticate the JWT either by using Firebase
   * Token or the locally generated
   * @param req
   */
  async authenticate(req: Request): Promise<void> {
    const idToken = this.extractor(req)
    if (!idToken) {
      this.fail(UNAUTHORIZED, 401)
      return
    }

    if (process.env.AUTH_USE_FIREBASE) {
      console.log('validating with firebase')
      this.firebaseValidation(idToken)
      return
    }
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

// import { tokenService } from '@src/services/token.service'
import { TRPCError } from '@trpc/server'
import type * as trpcExpress from '@trpc/server/adapters/express'
import * as admin from 'firebase-admin'
import { ExtractJwt } from 'passport-jwt'
import { firebaseDecodedTokenSchema } from '../schemas/user.schema'
import { requestContext } from './request.context'

declare global {
  namespace Express {
    interface Request {
      context: ReturnType<typeof requestContext>
    }
  }
}

/**
 * Validate Firebase Token
 */
const validateFirebaseToken = async (
  idToken: string,
): Promise<admin.auth.DecodedIdToken | null> => {
  try {
    return await admin.auth().verifyIdToken(idToken)
  } catch {
    // Not a valid Firebase token
    return null
  }
}

/**
 * Validate Internal Token
 */
const validateInternalToken = async (
  _token: string,
): Promise<{
  ownerId?: string | null
  purpose?: 'API_ACCESS' | 'INTERNAL_SERVICE'
} | null> => {
  // const isValid = await tokenService.validateToken({
  //   providedToken: token,
  //   purpose: 'INTERNAL_SERVICE', // Adjust if needed
  // })

  // if (isValid) {
  //   // Optionally fetch more details about the token if needed
  //   const tokenDetails = await tokenService.getTokenDetails(token)
  //   return {
  //     ownerId: tokenDetails?.ownerId,
  //     purpose: tokenDetails?.purpose,
  //   }
  // }

  return null
}

export const createContext = async ({
  req,
}: trpcExpress.CreateExpressContextOptions): Promise<
  ReturnType<typeof requestContext>
> => {
  const idToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req)

  if (idToken) {
    try {
      // Check if it's a Firebase Token
      const firebaseUser = await validateFirebaseToken(idToken)

      const email = firebaseUser?.email
      // const emailVerified = firebaseUser?.email_verified ?? false

      if (firebaseUser && email) {
        //sentryService.setUserId(firebaseUser.uid)
        return requestContext(
          req,
          firebaseDecodedTokenSchema.parse(firebaseUser),
        )
      }

      // Check if it's an internally generated token
      const internalToken = await validateInternalToken(idToken)
      if (internalToken) {
        // sentryService.setUserId(internalToken.ownerId || 'INTERNAL')
        return requestContext(req, { tokenPurpose: internalToken.purpose })
      }

      throw new Error('Invalid token format')
    } catch (err: any) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: err.message })
    }
  }

  return requestContext(req)
}

export type TrpcContext = Awaited<ReturnType<typeof createContext>>

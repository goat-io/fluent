import { z } from 'zod'

export const firebaseDecodedTokenSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  auth_time: z.number(),
  sub: z.string(),
  iat: z.number(),
  exp: z.number(),
  email: z.string(),
  email_verified: z.boolean(),
  firebase: z.any().optional(),
  uid: z.string(),
  displayName: z.string().optional(),
  name: z.string().optional(),
  ownerId: z.string().optional(),
  user_id: z.string().optional(),
})

export const internalTokenSchema = z.object({
  tokenPurpose: z.string().optional(),
})

export const requestTokenSchema = z.union([
  firebaseDecodedTokenSchema,
  internalTokenSchema,
])

export type FirebaseDecodedToken = z.infer<typeof firebaseDecodedTokenSchema>
export type TokenBasedAccess = z.infer<typeof internalTokenSchema>

export type DecodedUserToken = z.infer<typeof requestTokenSchema>

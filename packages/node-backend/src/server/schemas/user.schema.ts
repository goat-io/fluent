import { z } from 'zod'

/**
 * Decoded user token schema (Better Auth compatible)
 * This format is used internally after token validation
 */
export const decodedUserTokenSchema = z.object({
  /** Issuer (e.g., 'better-auth') */
  iss: z.string(),
  /** Audience */
  aud: z.string(),
  /** Authentication time (Unix timestamp) */
  auth_time: z.number(),
  /** Subject (user ID) */
  sub: z.string(),
  /** Issued at (Unix timestamp) */
  iat: z.number(),
  /** Expiration (Unix timestamp) */
  exp: z.number(),
  /** User's email address */
  email: z.string(),
  /** Whether email has been verified */
  email_verified: z.boolean(),
  /** User's unique ID (same as sub) */
  uid: z.string(),
  /** User's display name */
  displayName: z.string().optional(),
  /** User's name */
  name: z.string().optional(),
  /** Owner ID (for internal tokens) */
  ownerId: z.string().optional(),
  /** Alternative user ID field */
  user_id: z.string().optional(),
})

/**
 * Internal token schema for service-to-service auth
 */
export const internalTokenSchema = z.object({
  tokenPurpose: z.string().optional(),
})

/**
 * Combined request token schema
 */
export const requestTokenSchema = z.union([
  decodedUserTokenSchema,
  internalTokenSchema,
])

export type DecodedUserToken = z.infer<typeof decodedUserTokenSchema>
export type TokenBasedAccess = z.infer<typeof internalTokenSchema>
export type RequestUser = z.infer<typeof requestTokenSchema>

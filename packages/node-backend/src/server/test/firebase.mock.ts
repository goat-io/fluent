import type { DecodedUserToken } from '../schemas/user.schema'
import { BasicAccount } from './mock.model'

export const mockedDecodedUserToken = (
  mockedAccount?: Partial<BasicAccount>,
): DecodedUserToken => {
  const account = mockedAccount || {
    email: 'testemail@test.com',
    userId: 'testUserId',
  }

  const payload: DecodedUserToken = {
    aud: 'app',
    auth_time: 1664050702,
    email: account.email || '',
    email_verified: true,
    exp: 1695579492,
    iat: 1664050702,
    iss: 'better-auth',
    sub: account.userId ?? 'someUserId',
    uid: account.userId ?? 'someUserId',
  }
  return payload
}

export const mockAuthToken = (account?: Partial<BasicAccount>): string => {
  const payload = mockedDecodedUserToken(account)
  // This should be a session token, but it is just a mock
  return JSON.stringify(payload)
}

// Legacy aliases
export const mockedFirebaseDecodedToken = mockedDecodedUserToken
export const mockFirebaseToken = mockAuthToken

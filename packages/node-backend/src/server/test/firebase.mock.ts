import type { FirebaseDecodedToken } from '../schemas/user.schema'
import { BasicAccount } from './mock.model'

export const mockedFirebaseDecodedToken = (
  mockedAccount?: Partial<BasicAccount>
): FirebaseDecodedToken => {
  const account = mockedAccount || {
    email: 'testemail@test.com',
    firebaseId: 'testfirebaseId'
  }

  const payload: FirebaseDecodedToken = {
    aud: 'someFakeAudience',
    auth_time: 1664050702,
    email: account.email || '',
    email_verified: true,
    exp: 1695579492,
    iat: 1664050702,
    iss: 'someFakeProject',
    sub: '12312312312',
    uid: account.firebaseId ?? 'someFakeFirebaseId',
    firebase: true
  }
  return payload
}

export const mockFirebaseToken = (account?: Partial<BasicAccount>): string => {
  const payload = mockedFirebaseDecodedToken(account)
  // This should be a JWT, but it is just a mock
  return JSON.stringify(payload)
}

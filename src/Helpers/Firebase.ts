import * as admin from 'firebase-admin'

export declare type FirebaseUser = admin.auth.DecodedIdToken

export const Firebase = (() => {
  const verifyIdToken = (token: string) => {
    return admin.auth().verifyIdToken(token)
  }
  return Object.freeze({ verifyIdToken })
})()

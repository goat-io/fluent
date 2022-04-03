import * as admin from 'firebase-admin'
import {getAuth as firebaseGetAuth} from 'firebase-admin/auth'
export declare type FirebaseUser = admin.auth.DecodedIdToken

export const Firebase = (() => {
  const verifyIdToken = (token: string) => admin.auth().verifyIdToken(token)

  const getAuth = firebaseGetAuth
  return Object.freeze({ verifyIdToken, getAuth })
})()

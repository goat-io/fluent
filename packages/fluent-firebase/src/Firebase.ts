import * as admin from 'firebase-admin'
import { getAuth as firebaseGetAuth } from 'firebase-admin/auth'
export declare type FirebaseUser = admin.auth.DecodedIdToken

class FirebaseClass {
  verifyIdToken = (token: string) => admin.auth().verifyIdToken(token)

  getAuth = firebaseGetAuth
}

export const Firebase = new FirebaseClass()

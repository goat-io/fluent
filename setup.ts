import * as admin from 'firebase-admin'
import { initialize } from 'fireorm'

/*
const serviceAccount = {
  projectId: process.env.FIRESTORE_PROJECT_ID,
  databaseUrl: process.env.FIREBASE_DATABASE_URL,
  privateKey: Buffer.from(
    process.env.FIRESTORE_PRIVATE_KEY_BASE_64,
    'base64'
  ).toString('ascii'),
  clientEmail: process.env.FIRESTORE_CLIENT_EMAIL
}
*/
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
admin.initializeApp({
  projectId: 'wittra',
  credential: admin.credential.applicationDefault()
})
const firestore = admin.firestore()
initialize(firestore)

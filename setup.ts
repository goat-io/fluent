import { FirebaseInit } from './src/Providers/Firebase/FirebaseInit'
import { join } from 'path'

FirebaseInit({
  databaseName: 'fluent-cd90c',
  serviceAccountPath: join(__dirname, './fluent-service-account.json')
})
/*

 if (false) {
    // process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
    admin.initializeApp({
      projectId: 'fluent',
      credential: admin.credential.applicationDefault()
    })
  }
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

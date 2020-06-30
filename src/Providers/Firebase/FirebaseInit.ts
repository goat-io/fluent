import * as admin from 'firebase-admin'
import * as fireorm from 'fireorm'

interface ICreateConnection {
  host?: string
  port?: number
  databaseName?: string
  serviceAccountPath?: string
}

export const FirebaseInit = ({
  host,
  port,
  databaseName,
  serviceAccountPath
}: ICreateConnection) => {
  if (host && port) {
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`
  }
  const serviceAccount = require(serviceAccountPath)
  const app = admin.initializeApp({
    projectId: databaseName,
    credential: serviceAccountPath
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault()
  })

  const firestore = app.firestore()
  fireorm.initialize(firestore)
}

import * as admin from 'firebase-admin'

interface ConnectionOptions {
  host?: string
  port?: number
  databaseName?: string
  serviceAccount?: string
}

export const FirebaseInit = ({
  host,
  port,
  databaseName,
  serviceAccount
}: ConnectionOptions): void => {
  if (admin.apps.length) {
    return
  }
  if (host && port) {
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`
  }

  admin.initializeApp({
    projectId: databaseName,
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault()
  })

  const fireStore = admin.firestore()
  fireStore.settings({ ignoreUndefinedProperties: true })

  if (!fireStore) {
    throw new Error('Could not initialize FireStore')
  }
}

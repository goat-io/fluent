import * as admin from 'firebase-admin'
import * as fireorm from 'fireorm'

interface ConnectionOptions {
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
}: ConnectionOptions): void => {
  if (admin.apps.length) {
    return
  }
  if (host && port) {
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`
  }

  const serviceAccount = serviceAccountPath
    ? require(serviceAccountPath)
    : undefined

  admin.initializeApp({
    projectId: databaseName,
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault()
  })

  const fireStore = admin.firestore()
  fireStore.settings({ ignoreUndefinedProperties: true })
  fireorm.initialize(fireStore)

  if (!fireStore) {
    throw new Error('Could not initialize FireStore')
  }
}
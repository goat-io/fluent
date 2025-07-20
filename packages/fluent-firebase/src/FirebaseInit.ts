import * as admin from 'firebase-admin'

interface ConnectionOptions {
  host?: string
  port?: number
  databaseName?: string
  serviceAccount?: string
  emulator?: boolean
}

export const FirebaseInit = ({
  host,
  port,
  databaseName,
  serviceAccount,
  emulator = false
}: ConnectionOptions): void => {
  if (admin.apps.length) {
    return
  }
  
  // Set up emulator environment if specified
  if (emulator || (host && port)) {
    const emulatorHost = host || 'localhost'
    const emulatorPort = port || 8080
    process.env['FIRESTORE_EMULATOR_HOST'] = `${emulatorHost}:${emulatorPort}`
    
    // Also set auth emulator for completeness
    if (!process.env['FIREBASE_AUTH_EMULATOR_HOST']) {
      process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `${emulatorHost}:9099`
    }
  }

  const initOptions: admin.AppOptions = {
    projectId: databaseName || 'fluent-firebase-test'
  }

  // Only add credentials if not using emulator and serviceAccount is provided
  if (!emulator && serviceAccount) {
    initOptions.credential = admin.credential.cert(serviceAccount)
  } else if (!emulator) {
    initOptions.credential = admin.credential.applicationDefault()
  }

  admin.initializeApp(initOptions)

  const fireStore = admin.firestore()
  fireStore.settings({ ignoreUndefinedProperties: true })

  if (!fireStore) {
    throw new Error('Could not initialize FireStore')
  }
}

export const deleteFirebaseApps = () => {
  return Promise.all(admin.apps.map(app => app?.delete()))
}

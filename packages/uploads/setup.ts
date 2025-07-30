import 'reflect-metadata'
import { join } from 'path'
import { FirebaseInit } from './src/Providers/Firebase/FirebaseInit'

const path = join(__dirname, './fluent-service-account.json')

FirebaseInit({
  databaseName: 'fluent-cd90c',
  serviceAccountPath: path
})

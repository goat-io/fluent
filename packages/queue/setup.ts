import 'reflect-metadata'
import { FirebaseInit } from './src/Providers/Firebase/FirebaseInit'
import { join } from 'path'

const path = join(__dirname, './fluent-service-account.json')

FirebaseInit({
  databaseName: 'fluent-cd90c',
  serviceAccountPath: path
})

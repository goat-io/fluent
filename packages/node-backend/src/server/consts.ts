import { join } from 'node:path'
import { cwd } from 'node:process'

const rootPath = cwd()

export const pkg = require(join(rootPath, 'package.json')) as {
  name: string
  version: string
}

export interface PackageInfo {
  name: string
  version: string
  description: string
}

export const srcPath = join(rootPath, './src')
export const secretStoragePath = join(srcPath, `/_secrets/storage`)
export const envPath = join(srcPath, `./_env/sodium`)
export const templateDir = join(srcPath, './services/email/templates')
export const langDir = join(srcPath, './lang')
// Stores Test
export const appStoreTestEmail = 'appstore@test.com'
export const playStoreTestEmail = 'playstore@test.com'

// Testing
export const frontendTestUser = `testUser@test.gealium.com`
export const testEmailRegex =
  /^testUser(?:_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?@test\.gealium\.com$/i

export const defaultTimeZone = 'America/Santiago'

export const config = {
  pkg,
  srcPath,
  secretStoragePath,
  envPath,
  templateDir,
  langDir,
  appStoreTestEmail,
  playStoreTestEmail,
  frontendTestUser,
  testEmailRegex,
  defaultTimeZone
}

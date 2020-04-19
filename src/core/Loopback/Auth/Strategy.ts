import { PackageInfo } from '../goat'
import { use } from './providers/jwt/jwt'

export const Strategy = (() => {
  const jwt = (app: any, pkg: PackageInfo) => {
    use(app, pkg)
  }
  return Object.freeze({ jwt })
})()

import { Formio } from './Authenticators/Formio'
import { Keycloak } from './Authenticators/Keycloak'
import { Loopback } from './Authenticators/Loopback'

export enum Authenticators {
  FORMIO = 'formio',
  KEYCLOAK = 'keycloak',
  LOOPBACK = 'loopback'
}

export class Auth {
  public static using(type: Authenticators.FORMIO): Formio
  public static using(type: Authenticators.LOOPBACK): Loopback
  public static using(type: Authenticators.KEYCLOAK): Keycloak

  public static using(type: Authenticators) {
    if (type === Authenticators.FORMIO) {
      return new Formio()
    } else if (type === Authenticators.KEYCLOAK) {
      return new Keycloak()
    }
  }
}

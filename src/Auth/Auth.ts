export enum Authenticators {
  FORMIO = 'formio',
  KEYCLOAK = 'keycloak',
  LOOPBACK = 'loopback'
}

export class Auth {
  public static using(type: Authenticators) {}
}

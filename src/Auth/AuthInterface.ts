export interface AuthInterface {
  user(): object
  email(): string
  hasRoleIn(roles: string[]): boolean
  hasRoleIdIn(roles: string[]): Promise<boolean>
  hasRole(role: string): boolean
  check(): any
  logOut(): void
  attempt(credentials): Promise<object>
}

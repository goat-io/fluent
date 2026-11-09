export type HatchetStartupDiagnostics = {
  classifications: string[]
  mentionedConfigurationKeys: string[]
  expectedTenantIdSeen: boolean
  expectedTenantLogSeen: boolean
  recentLogChars: number
}

export type HatchetStartupDiagnostics = {
  classifications: string[]
  mentionedConfigurationKeys: string[]
  proposedReadinessMatch: boolean
  caseInsensitiveExactMatch: boolean
  tenantIdBeforeMarkerSameLine: boolean
  safeTenantCreationForm?: string
  expectedTenantIdSeen: boolean
  expectedTenantLogSeen: boolean
  recentLogChars: number
}

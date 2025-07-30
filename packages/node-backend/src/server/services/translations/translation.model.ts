export type Lang = 'en_us' | 'en_gb' | 'es_us' | 'es_cl' | 'es_mx'

export const SUPPORTED_LANGUAGES: Lang[] = [
  'en_us',
  'en_gb',
  'es_us',
  'es_cl',
  'es_mx'
]
export const LANG_DEFAULT = 'en_us'

export const missingTranslationExcludeList = new Set<string>([])

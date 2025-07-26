export type LANG = 'en_us' | 'en_gb' | 'es_us' | 'es_cl' | 'es_mx'

export declare const SUPPORTED_LANGUAGES: LANG[]
export const LANG_DEFAULT = 'en_us'

export const missingTranslationExcludeList = new Set<string>([])

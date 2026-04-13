import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StringMap } from '@goatlab/js-utils'
import { MissingValueError, pupa } from '@goatlab/js-utils/dist/Strings/pupa'
import { config } from '../../consts'
// import { templateUtil } from './template.util' // No longer needed with direct pupa usage
import { LANG_DEFAULT, Lang, SUPPORTED_LANGUAGES } from './translation.model'

/* eslint-disable @typescript-eslint/no-require-imports */
export interface UserLanguageOptions {
  language: Lang | null
}

// Cache for compiled templates - key format: "lang:key"
const templateCache = new Map<string, (args: any) => string>()

// Cache for loaded locale files
const localeCache = new Map<Lang, StringMap>()

// Precompile template function
function compileTemplate(template: string): (args: any) => string {
  // Pre-parse the template to identify placeholders
  const doubleBraceRegex = /{{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}}/gi
  const braceRegex = /{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}/gi

  const hasDoubleBraces = doubleBraceRegex.test(template)
  const hasSingleBraces = braceRegex.test(template)

  // If no placeholders, return a function that returns the template as-is
  if (!hasDoubleBraces && !hasSingleBraces) {
    return () => template
  }

  // Return optimized template function
  return (args: any) => {
    if (!args || Object.keys(args).length === 0) {
      return template
    }
    return pupa(template, args)
  }
}

class TranslationService {
  private initialized = false

  // Initialize service by preloading all locale files
  public initialize(): void {
    if (this.initialized) {
      return
    }

    // Preload all supported language files
    const loadedLanguages: Lang[] = []
    if (SUPPORTED_LANGUAGES && Array.isArray(SUPPORTED_LANGUAGES)) {
      for (const lang of SUPPORTED_LANGUAGES) {
        if (this.loadLocaleSync(lang)) {
          loadedLanguages.push(lang)
        }
      }
    }

    if (loadedLanguages.length > 0) {
      console.log(
        `Translation service initialized with languages: ${loadedLanguages.join(', ')}`,
      )
    } else {
      console.warn('Translation service: No language files were loaded')
    }

    this.initialized = true
  }

  // Load locale file synchronously (used during initialization)
  private loadLocaleSync(lang: Lang): StringMap | undefined {
    if (localeCache.has(lang)) {
      return localeCache.get(lang)
    }

    try {
      const filePath = join(config.langDir, `${lang}.json`)
      const content = readFileSync(filePath, 'utf-8')
      const locale = JSON.parse(content) as StringMap
      localeCache.set(lang, locale)
      return locale
    } catch {
      // Silent fail - we'll log successful loads instead
      return undefined
    }
  }
  // Get locale from cache (backward compatible)
  getLocale(lang: Lang | null): StringMap {
    if (!lang) {
      return undefined as any
    }

    // Ensure initialization
    if (!this.initialized) {
      this.initialize()
    }

    const cached = localeCache.get(lang)
    if (cached) {
      // Return a copy to maintain backward compatibility
      return { ...cached }
    }

    // Try to load dynamically if not in cache (backward compatibility)
    try {
      const locale = { ...require(`${config.langDir}/${lang}.json`) }
      localeCache.set(lang, locale)
      return locale
    } catch {
      // Silent fail - already logged during initialization
      return undefined as any
    }
  }

  getLocaleMap(): Record<Lang, StringMap> {
    // Ensure initialization
    if (!this.initialized) {
      this.initialize()
    }

    const map: Record<Lang, StringMap> = {} as Record<Lang, StringMap>

    // Use cached locales if available
    if (SUPPORTED_LANGUAGES && Array.isArray(SUPPORTED_LANGUAGES)) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const locale = localeCache.get(lang) || this.getLocale(lang)
        if (locale) {
          map[lang] = locale
        }
      }
    }

    return map
  }

  missingKey(key: string): string {
    return `[${key}]`
  }

  translate(key: string, acc: UserLanguageOptions, args: any = {}): string {
    const v = this.translateIfExists(key, acc, args)

    if (!v) {
      this.reportMissing(key, acc)
      if (process.env.MOCK_LANG && process.env.MOCK_LANG_THROW_IF_NOT_FOUND) {
        throw new Error(`key ${key} does not exist`)
      }
    }

    return v ?? this.missingKey(key)
  }

  /**
   * Implementation based on static ./src/lang/*.json files
   */
  translateIfExists(
    key: string,
    user: UserLanguageOptions,
    args = {},
  ): string | undefined {
    // Ensure initialization
    if (!this.initialized) {
      this.initialize()
    }

    // Get locale from cache directly for better performance
    const locale = user.language ? localeCache.get(user.language) : undefined
    const fallbackLocale =
      localeCache.get(LANG_DEFAULT) || this.getLocale(LANG_DEFAULT)

    const value = locale?.[key] ?? fallbackLocale?.[key]
    return value && this.formatResult(key, value, args)
  }

  formatResult(key: string, text: string, args = {}): string {
    if (process.env.MOCK_LANG) {
      return `** ${key} **`
    }

    if (Object.keys(args).length) {
      // Check template cache first
      const cacheKey = `${key}:${text}`
      let compiledTemplate = templateCache.get(cacheKey)

      if (!compiledTemplate) {
        // Compile and cache the template
        compiledTemplate = compileTemplate(text)
        templateCache.set(cacheKey, compiledTemplate)
      }

      try {
        return compiledTemplate(args)
      } catch (err: unknown) {
        if (err instanceof MissingValueError) {
          // sentryService.captureMessage(
          //   `template value missing for key=${key}, param=${err.key}`,
          // )
          return pupa(text, args, { ignoreMissing: true })
        }

        throw err
      }
    } else {
      return text
    }
  }

  reportMissing(_key: string, opt: UserLanguageOptions): void {
    console.log(opt as any) // For Sentry
    //sentryService.captureMessage(`translation missing for key=${key}}`)
  }

  /**
   * Based on: https://nodejs.org/api/intl.html#intl_detecting_internationalization_support
   */
  hasFullICU(): boolean {
    try {
      const january = new Date(9e8)
      const spanish = new Intl.DateTimeFormat('es', { month: 'long' })
      return spanish.format(january) === 'enero'
    } catch {
      return false
    }
  }

  /**
   * Clear cache and reinitialize - useful for testing
   */
  clearCacheAndReinitialize(): void {
    // Clear all caches
    localeCache.clear()
    templateCache.clear()

    // Reset initialization state
    this.initialized = false

    // Reinitialize
    this.initialize()
  }
}

export const translationService = new TranslationService()

// Initialize on module load to preload all locales
if (
  typeof SUPPORTED_LANGUAGES !== 'undefined' &&
  Array.isArray(SUPPORTED_LANGUAGES)
) {
  translationService.initialize()
}

// Alias
export function tr(key: string, user: UserLanguageOptions, args = {}): string {
  return translationService.translate(key, user, args)
}

export function trIfExists(
  key: string,
  user: UserLanguageOptions,
  args = {},
): string | undefined {
  return translationService.translateIfExists(key, user, args)
}

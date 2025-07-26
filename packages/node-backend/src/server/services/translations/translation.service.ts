import type { StringMap } from '@goatlab/js-utils'
import { MissingValueError } from '@goatlab/js-utils/dist/Strings/pupa'
import { config } from '../../consts'
import { templateUtil } from './template.util'
import { LANG, LANG_DEFAULT, SUPPORTED_LANGUAGES } from './translation.model'

/* eslint-disable @typescript-eslint/no-require-imports */
export interface UserLanguageOptions {
  language: LANG | null
}

class TranslationService {
  // @Memo.syncMethod()
  getLocale(lang: LANG | null): StringMap {
    try {
      return { ...require(`${config.langDir}/${lang}.json`) }
    } catch {
      console.warn(`Unsupported lang ${lang}`)
      return undefined as any
    }
  }

  getLocaleMap(): Record<LANG, StringMap> {
    return SUPPORTED_LANGUAGES.reduce(
      (map, lang) => {
        map[lang] = this.getLocale(lang)
        return map
      },
      {} as Record<LANG, StringMap>,
    )
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
    const fallbackLocale = this.getLocale(LANG_DEFAULT)
    const locale = this.getLocale(user.language)
    const value = locale[key] ?? fallbackLocale[key]
    return value && this.formatResult(key, value, args)
  }

  formatResult(key: string, text: string, args = {}): string {
    if (process.env.MOCK_LANG) {
      return `** ${key} **`
    }

    if (Object.keys(args).length) {
      try {
        return templateUtil.renderString(text, args)
      } catch (err: unknown) {
        if (err instanceof MissingValueError) {
          // sentryService.captureMessage(
          //   `template value missing for key=${key}, param=${err.key}`,
          // )
          return templateUtil.renderString(text, args, { ignoreMissing: true })
        }

        throw err
      }
    } else {
      return text
    }
  }

  reportMissing(key: string, opt: UserLanguageOptions): void {
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
}

export const translationService = new TranslationService()

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

import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import de from './locales/de.json'
import type { MessageSchema, AvailableLocale } from './types'

const AVAILABLE_LOCALES: AvailableLocale[] = ['en', 'de']
const FALLBACK_LOCALE: AvailableLocale = 'en'
const LOCALE_STORAGE_KEY = 'vue-i18n-locale'

/**
 * Get initial locale from localStorage or browser preference
 */
function getInitialLocale(): AvailableLocale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as AvailableLocale
    if (stored && AVAILABLE_LOCALES.includes(stored)) {
      return stored
    }

    const browserLang = navigator.language.substring(0, 2) as AvailableLocale
    if (AVAILABLE_LOCALES.includes(browserLang)) {
      return browserLang
    }
  }

  return FALLBACK_LOCALE
}

/**
 * Setup vue-i18n with i18n resources with global type definition.
 * The schema is defined in types/vue-i18n.d.ts using DefineLocaleMessage
 */
const i18n = createI18n<[MessageSchema], AvailableLocale>({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    en,
    de,
  },
  globalInjection: true,
})

export default i18n
export { AVAILABLE_LOCALES, FALLBACK_LOCALE, LOCALE_STORAGE_KEY }
export type { MessageSchema, AvailableLocale } from './types'

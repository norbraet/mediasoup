import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import de from './locales/de.json'
import type { MessageSchema } from './types'

/**
 * Setup vue-i18n with i18n resources with global type definition.
 * The schema is defined in types/vue-i18n.d.ts using DefineLocaleMessage
 */
const i18n = createI18n<[MessageSchema], 'en' | 'de'>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    de,
  },
  globalInjection: true,
})

export default i18n
export type { MessageSchema, AvailableLocale } from './types'

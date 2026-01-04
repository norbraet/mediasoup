import { useI18n as useVueI18n } from 'vue-i18n'
import type { AvailableLocale } from '../i18n/types'
import { AVAILABLE_LOCALES, LOCALE_STORAGE_KEY } from '../i18n'

/**
 * Type-safe composable for vue-i18n using global scope.
 * The schema is defined globally in types/vue-i18n.d.ts
 * Automatically persists locale changes to localStorage
 */
export function useTypedI18n() {
  // Use global scope - no need to specify type parameters with global schema
  const { t, locale, availableLocales } = useVueI18n({
    inheritLocale: true,
    useScope: 'global',
  })

  // Type-safe locale switching with localStorage persistence
  const setLocale = (newLocale: AvailableLocale): void => {
    if (AVAILABLE_LOCALES.includes(newLocale)) {
      locale.value = newLocale

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
      }
    } else {
      console.warn(
        `Invalid locale: ${newLocale}. Available locales: ${AVAILABLE_LOCALES.join(', ')}`
      )
    }
  }

  // Get current locale with proper typing
  const getCurrentLocale = (): AvailableLocale => {
    return locale.value as AvailableLocale
  }

  // Get available locales with proper typing
  const getAvailableLocales = (): AvailableLocale[] => {
    return AVAILABLE_LOCALES
  }

  // Get stored locale from localStorage
  const getStoredLocale = (): AvailableLocale | null => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as AvailableLocale
      return stored && AVAILABLE_LOCALES.includes(stored) ? stored : null
    }
    return null
  }

  // Clear stored locale from localStorage
  const clearStoredLocale = (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCALE_STORAGE_KEY)
    }
  }

  return {
    t, // This now has full TypeScript autocompletion for keys
    setLocale,
    getCurrentLocale,
    getAvailableLocales,
    getStoredLocale,
    clearStoredLocale,
    locale,
    availableLocales,
  }
}

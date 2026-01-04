import { useI18n as useVueI18n } from 'vue-i18n'
import type { AvailableLocale } from '../i18n/types'

/**
 * Type-safe composable for vue-i18n using global scope.
 * The schema is defined globally in types/vue-i18n.d.ts
 */
export function useTypedI18n() {
  // Use global scope - no need to specify type parameters with global schema
  const { t, locale, availableLocales } = useVueI18n({
    inheritLocale: true,
    useScope: 'global',
  })

  // Type-safe locale switching
  const setLocale = (newLocale: AvailableLocale): void => {
    locale.value = newLocale
  }

  // Get current locale with proper typing
  const getCurrentLocale = (): AvailableLocale => {
    return locale.value as AvailableLocale
  }

  // Get available locales with proper typing
  const getAvailableLocales = (): AvailableLocale[] => {
    return availableLocales as AvailableLocale[]
  }

  return {
    t, // This now has full TypeScript autocompletion for keys
    setLocale,
    getCurrentLocale,
    getAvailableLocales,
    locale,
    availableLocales,
  }
}

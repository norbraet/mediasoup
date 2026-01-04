<script setup lang="ts">
  import { useTypedI18n } from '../composables/useI18n'
  import LanguageSwitcher from './LanguageSwitcher.vue'
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { MessageSchema } from '../i18n/types'

  const { getCurrentLocale, getAvailableLocales } = useTypedI18n()
  const { messages } = useI18n()

  const currentLocale = ref(getCurrentLocale())
  const availableLocales = getAvailableLocales()

  // Function to flatten nested object with dot notation keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {}

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = prefix ? `${prefix}.${key}` : key

        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, flattenObject(obj[key], newKey))
        } else {
          flattened[newKey] = String(obj[key])
        }
      }
    }

    return flattened
  }

  // Get all translation keys dynamically
  const allTranslations = computed(() => {
    const result: Record<string, Record<string, string>> = {}

    availableLocales.forEach((locale) => {
      const localeMessages = messages.value[locale] as MessageSchema
      result[locale] = flattenObject(localeMessages)
    })

    return result
  })

  // Get all unique translation keys
  const allKeys = computed(() => {
    const keys = new Set<string>()

    Object.values(allTranslations.value).forEach((translations) => {
      Object.keys(translations).forEach((key) => keys.add(key))
    })

    return Array.from(keys).sort()
  })

  // Update current locale when language changes
  const updateCurrentLocale = () => {
    currentLocale.value = getCurrentLocale()
  }

  // Watch for locale changes (simple polling approach)
  setInterval(updateCurrentLocale, 100)
</script>

<template>
  <div class="i18n-example">
    <div class="header">
      <h1>i18n Translation Overview</h1>
      <div class="controls">
        <span class="current-locale"
          >Current: <strong>{{ currentLocale.toUpperCase() }}</strong></span
        >
        <LanguageSwitcher />
      </div>
    </div>

    <div class="live-demo">
      <p class="demo-instruction">👆 Switch languages above to see real-time changes!</p>
    </div>
    <div class="stats">
      <div class="stat">
        <span class="label">Available Locales:</span>
        <span class="value">{{ availableLocales.length }} ({{ availableLocales.join(', ') }})</span>
      </div>
      <div class="stat">
        <span class="label">Translation Keys:</span>
        <span class="value">{{ allKeys.length }}</span>
      </div>
    </div>

    <div class="translations-table">
      <h2>All Available Translations</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="key-column">Translation Key</th>
              <th v-for="locale in availableLocales" :key="locale" class="locale-column">
                {{ locale.toUpperCase() }}
                <span class="locale-flag">{{ locale === 'en' ? '🇬🇧' : '🇩🇪' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="key in allKeys" :key="key" class="translation-row">
              <td class="key-cell">
                <code>{{ key }}</code>
              </td>
              <td v-for="locale in availableLocales" :key="locale" class="value-cell">
                <span
                  class="translation-value"
                  :class="{ 'current-locale': locale === currentLocale }"
                >
                  {{ allTranslations[locale]?.[key] || '❌ Missing' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .i18n-example {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
  }

  .header h1 {
    margin: 0;
    color: #2d3748;
    font-size: 2rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .current-locale {
    font-size: 0.9rem;
    color: #4a5568;
  }

  .stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f7fafc;
    border-radius: 8px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat .label {
    font-size: 0.875rem;
    color: #718096;
    font-weight: 500;
  }

  .stat .value {
    font-size: 1.125rem;
    color: #2d3748;
    font-weight: 600;
  }

  .translations-table {
    margin: 2rem 0;
  }

  .translations-table h2 {
    margin-bottom: 1rem;
    color: #2d3748;
  }

  .table-container {
    overflow-x: auto;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  thead {
    background: #4a5568;
    color: white;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .key-column {
    min-width: 200px;
    background: #2d3748;
  }

  .locale-column {
    min-width: 150px;
    text-align: center;
  }

  .locale-flag {
    margin-left: 0.5rem;
    font-size: 1.2rem;
  }

  .translation-row:nth-child(even) {
    background: #f7fafc;
  }

  .translation-row:hover {
    background: #edf2f7;
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }

  .key-cell {
    background: #2d3748;
    color: white;
    font-weight: 500;
  }

  .key-cell code {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8rem;
  }

  .value-cell {
    text-align: center;
  }

  .translation-value {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
    min-width: 80%;
    transition: all 0.2s ease;
  }

  .translation-value.current-locale {
    background: #48bb78;
    color: white;
    font-weight: 600;
    transform: scale(1.05);
  }

  .live-demo {
    margin: 2rem 0;
    padding: 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #514ba2 100%);
    color: white;
    border-radius: 12px;
    text-align: center;
  }

  .live-demo h2 {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .live-demo code {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .demo-instruction {
    font-size: 0.9rem;
    opacity: 0.9;
  }
</style>

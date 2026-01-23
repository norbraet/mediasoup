<script setup lang="ts">
  import { useTypedI18n } from '../composables/useI18n'
  import type { AvailableLocale } from '../i18n/types'
  import { computed } from 'vue'

  const { setLocale, getAvailableLocales, locale } = useTypedI18n()

  // Use the reactive locale directly from i18n - this will sync across all instances
  const currentLocale = computed(() => locale.value as AvailableLocale)
  const availableLocales = getAvailableLocales()

  const handleLanguageChange = (event: Event) => {
    const target = event.target as HTMLSelectElement
    const newLocale = target.value as AvailableLocale
    setLocale(newLocale)
  }

  // Language display names
  const languageNames: Record<AvailableLocale, string> = {
    en: 'English',
    de: 'Deutsch',
  }
</script>

<template>
  <nav class="language-switcher">
    <select
      :value="currentLocale"
      class="language-select"
      name="Language Selector"
      @change="handleLanguageChange"
    >
      <option
        v-for="availableLocale in availableLocales"
        :key="availableLocale"
        :value="availableLocale"
      >
        {{ languageNames[availableLocale] }}
      </option>
    </select>
  </nav>
</template>

<style scoped>
  .language-switcher {
    display: inline-block;
  }

  .language-select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
  }

  .language-select:hover {
    border-color: #666;
  }
</style>

<script setup lang="ts">
  import { useTypedI18n } from '../composables/useI18n'
  import type { AvailableLocale } from '../i18n/types'

  const { getCurrentLocale, setLocale, getAvailableLocales } = useTypedI18n()

  const currentLocale = getCurrentLocale()
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
  <div class="language-switcher">
    <select :value="currentLocale" class="language-select" @change="handleLanguageChange">
      <option v-for="locale in availableLocales" :key="locale" :value="locale">
        {{ languageNames[locale] }}
      </option>
    </select>
  </div>
</template>

<style scoped>
  .language-switcher {
    display: inline-block;
  }

  .language-select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: white;
    cursor: pointer;
  }

  .language-select:hover {
    border-color: #666;
  }
</style>

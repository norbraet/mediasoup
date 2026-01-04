<script setup lang="ts">
  import BaseMediaSoup from './components/BaseMediaSoup.vue'
  import ConferenceRoom from './views/ConferenceRoom.vue'
  import I18nExample from './components/I18nExample.vue'
  import LanguageSwitcher from './components/LanguageSwitcher.vue'
</script>

<template>
  <header>
    <div class="header-inner">
      <LanguageSwitcher />
    </div>
  </header>
  <main>
    <BaseMediaSoup />
    <ConferenceRoom room-name="Test Room" />
    <I18nExample />
  </main>
</template>

<style scoped>
  header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }

  .header-inner {
    max-width: 1400px;
    height: 4rem;
    margin: 0 auto;
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    gap: 2rem;
  }
</style>

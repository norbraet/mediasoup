<script setup lang="ts">
  import { useTypedI18n } from '../composables/useI18n'

  defineProps<{
    roomName?: string
  }>()

  const { t } = useTypedI18n()
</script>

<template>
  <section>
    <h1>{{ t('room.title') }}: {{ roomName }}</h1>
  </section>
</template>

<style scoped>
  section {
    margin: 0 auto;
    max-width: 1400px;
    padding: 2rem;
  }
</style>

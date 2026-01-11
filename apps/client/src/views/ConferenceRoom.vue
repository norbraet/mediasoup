<script setup lang="ts">
  import { onMounted, onUnmounted } from 'vue'
  import ConferenceControls from '../components/ConferenceControls.vue'
  import { useTypedI18n } from '../composables/useI18n'
  import { useConferenceRoom } from '../composables/useConferenceRoom'

  const props = defineProps<{
    roomName: string
  }>()

  const { t } = useTypedI18n()
  const conference = useConferenceRoom()
  const userName = 'Test User'

  onMounted(async () => {
    try {
      await conference.joinRoom(userName, props.roomName)
    } catch (error) {
      console.error('Failed to join room:', error)
    }
  })

  onUnmounted(() => {
    conference.leaveRoom()
  })
</script>

<template>
  <section>
    <h1>{{ t('room.title') }}: {{ roomName }}</h1>
    <ConferenceControls />
  </section>
</template>

<style scoped>
  section {
    margin: 0 auto;
    max-width: 1400px;
    padding: 2rem;
  }
</style>

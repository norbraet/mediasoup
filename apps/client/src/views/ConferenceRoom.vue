<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue'
  import ConferenceControls from '../components/ConferenceControls.vue'
  import { useTypedI18n } from '../composables/useI18n'
  import { useConferenceRoom } from '../composables/useConferenceRoom'

  const props = defineProps<{
    roomName: string
  }>()

  const { t } = useTypedI18n()
  const conference = useConferenceRoom()
  const userName = 'Test User'
  const localVideoRef = ref<HTMLVideoElement>()

  watch(
    localVideoRef,
    (videoElement) => {
      if (videoElement) {
        conference.localVideoRef.value = videoElement
      }
    },
    { immediate: true }
  )

  const handleToggleVideo = async (isNowVideoOff: boolean) => {
    try {
      if (!conference.localStream.value && !isNowVideoOff) {
        await conference.startVideo()
      } else {
        conference.toggleVideo()
      }
    } catch (error) {
      console.error('Failed to toggle video:', error)
    }
  }

  const handleToggleAudio = () => {
    conference.toggleAudio()
  }

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
  <section class="conference-room">
    <header class="room-header">
      <h1>{{ t('room.title') }}: {{ roomName }}</h1>
    </header>

    <div class="room-content">
      <div v-if="conference.currentRoom" class="video-container">
        <video ref="localVideoRef" autoplay muted playsinline class="local-video" />
      </div>
    </div>

    <footer class="room-controls">
      <ConferenceControls
        v-if="conference.currentRoom && !conference.joinError.value"
        :is-muted="!conference.isAudioEnabled"
        :is-video-off="!conference.isVideoEnabled"
        @toggle-video="handleToggleVideo"
        @toggle-audio="handleToggleAudio"
      />
    </footer>
  </section>
</template>

<style scoped>
  .conference-room {
    /* min-height: 100vh; */
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
  }

  .room-header {
    flex-shrink: 0;
    margin-bottom: 1rem;
  }

  .room-content {
    flex: 1;
  }

  .video-container {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .local-video {
    width: 100%;
    height: auto;
    max-height: 60vh;
    aspect-ratio: 16 / 9;
    background: #0f0f0f;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid #333;
    overflow: hidden;
    margin-top: 1rem;
  }

  .room-controls {
    flex-shrink: 0;
    margin-top: 1rem;
  }
</style>

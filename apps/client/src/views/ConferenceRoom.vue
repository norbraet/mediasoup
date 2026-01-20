<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import ConferenceControls from '../components/ConferenceControls.vue'
  import { useTypedI18n } from '../composables/useI18n'
  import { useConferenceRoom } from '../composables/useConferenceRoom'
  import RemoteParticipant from '../components/RemoteParticipant.vue'

  const props = defineProps<{
    roomName: string
  }>()

  const { t } = useTypedI18n()
  const conference = useConferenceRoom()
  const r = (Math.random() + 1).toString(36).substring(7)
  const userName = 'Test User: ' + r
  const localVideoRef = ref<HTMLVideoElement>()
  const isActuallyMuted = computed(
    () => !conference.isAudioEnabled.value || conference.isAudioMuted.value
  )

  watch(
    localVideoRef,
    (videoElement) => {
      if (videoElement) {
        conference.localVideoRef.value = videoElement
      }
    },
    { immediate: true }
  )

  const displayName = userName + ' (You)'

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
    try {
      conference.toggleAudio()
    } catch (error) {
      console.error('Failed to toggle audio:', error)
    }
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
    <div class="remote-participants-grid">
      <RemoteParticipant
        v-for="participant in Array.from(conference.participants.value.values())"
        :key="participant.userId"
        :participant="participant"
      />
      <div class="local-video-container">
        <video ref="localVideoRef" autoplay playsinline muted class="local-video" />
        <div class="local-label">{{ displayName }}</div>
      </div>
    </div>

    <footer class="room-controls">
      <ConferenceControls
        v-if="conference.currentRoom && !conference.joinError.value"
        :is-muted="isActuallyMuted"
        :is-video-off="!conference.isVideoEnabled"
        @toggle-video="handleToggleVideo"
        @toggle-audio="handleToggleAudio"
      />
    </footer>
  </section>
</template>

<style scoped>
  .conference-room {
    display: flex;
    gap: 1rem;
    flex-direction: column;
    height: 90vh;
    padding: 16px;
  }

  .local-video-container {
    position: relative;
    background: #000;
    border-radius: 8px;
    border: 1px solid #3d3d3d;
    overflow: hidden;
  }

  .local-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }

  .local-label {
    position: absolute;
    bottom: 8px;
    left: 8px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .remote-participants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
    flex: 1;
  }

  .controls {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 16px;
  }

  .controls button {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    background: #007bff;
    color: white;
    cursor: pointer;
    font-size: 16px;
  }
</style>

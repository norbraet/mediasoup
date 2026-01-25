<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import ConferenceControls from '../components/ConferenceControls.vue'
  import { useTypedI18n } from '../composables/useI18n'
  import { useConferenceRoom } from '../composables/useConferenceRoom'
  import RemoteParticipant from '../components/RemoteParticipant.vue'
  import { useVideoGrid } from '../composables/useVideoGrid'

  import LanguageSwitcher from '../components/LanguageSwitcher.vue'

  const props = defineProps<{
    roomName: string
  }>()

  const { t } = useTypedI18n()
  const conference = useConferenceRoom()
  const userName = (Math.random() + 1).toString(36).substring(7)
  const initalsUserName = userName.slice(0, 2).toUpperCase()
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

  // Debug: Watch for stream changes
  watch(
    () => conference.localStream.value,
    (stream) => {
      if (stream && localVideoRef.value) {
        localVideoRef.value.srcObject = stream
        // Force play if needed
        localVideoRef.value.play().catch((e) => console.debug('Video play failed (normal):', e))
      }
    },
    { immediate: true }
  )

  const displayName = userName + ' (You)'

  // Calculate total participants (remote + local - always include local slot)
  const totalParticipants = computed(() => {
    return conference.participants.value.size + 1 // Always include local participant
  })

  // Use video grid composable for dynamic layout
  const { gridConfig } = useVideoGrid(totalParticipants)

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

  const handleToggleAudio = async () => {
    try {
      // If no stream exists and we want to enable audio, start audio-only mode
      if (!conference.localStream.value && !conference.isAudioMuted.value) {
        await conference.startAudio()
      } else {
        // Toggle existing audio
        conference.toggleAudio()
      }
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
      <LanguageSwitcher />
    </header>

    <div
      class="video-grid"
      :style="{
        '--grid-columns': gridConfig.columns,
        '--grid-rows': gridConfig.rows,
        '--aspect-ratio': gridConfig.aspectRatio,
      }"
    >
      <!-- Remote Participants -->
      <div
        v-for="participant in Array.from(conference.participants.value.values())"
        :key="participant.userId"
        class="video-slot"
        :class="{ 'active-speaker': participant.isActiveSpeaker }"
      >
        <RemoteParticipant :participant="participant" />
      </div>

      <!-- Local Video (always show slot, but conditionally show video) -->
      <div class="video-slot local-slot">
        <div class="video-container">
          <video
            ref="localVideoRef"
            autoplay
            playsinline
            muted
            class="participant-video"
            :style="{
              display:
                conference.localStream.value && conference.isVideoEnabled.value ? 'block' : 'none',
            }"
          />
          <div
            v-if="!conference.localStream.value || !conference.isVideoEnabled.value"
            class="no-video-placeholder"
          >
            <p class="placeholder-text">{{ initalsUserName }}</p>
          </div>
          <div class="participant-label">{{ displayName }}</div>
        </div>
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
    flex-direction: column;
    height: 100vh;
    background: #202124;
    color: white;
  }

  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #3c4043;
  }

  .room-header h1 {
    font-size: 1.5rem;
    font-weight: 500;
    margin: 0;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-columns), 1fr);
    grid-template-rows: repeat(var(--grid-rows), 1fr);
    gap: 8px;
    padding: 16px;
    flex: 1;
    align-items: center;
    justify-items: center;
    min-height: 0; /* Allow grid to shrink */
  }

  .video-slot {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: var(--aspect-ratio);
    max-height: 100%;
  }

  .video-container {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    border-radius: 8px;
    border: 1px solid #3d3d3d;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .participant-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    background: #000;
    transform: scaleX(-1);
  }

  .no-video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #1a1a1a;
    color: #9aa0a6;
  }

  .placeholder-text {
    font-size: 8rem;
    opacity: 0.8;
  }

  .participant-label {
    position: absolute;
    bottom: 8px;
    left: 8px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .video-slot.active-speaker .video-container {
    border: 3px solid #34a853;
    box-shadow: 0 0 12px rgba(52, 168, 83, 0.4);
    animation: activeSpeakerPulse 2s infinite;
  }

  @keyframes activeSpeakerPulse {
    0%,
    100% {
      box-shadow: 0 0 12px rgba(52, 168, 83, 0.4);
    }
    50% {
      box-shadow: 0 0 20px rgba(52, 168, 83, 0.6);
    }
  }

  .room-controls {
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid #3c4043;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .video-grid {
      padding: 8px;
      gap: 4px;
    }

    .room-header {
      padding: 0.5rem;
    }

    .room-header h1 {
      font-size: 1.25rem;
    }
  }
</style>

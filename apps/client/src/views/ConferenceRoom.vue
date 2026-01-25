<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

  import ConferenceControls from '../components/ConferenceControls.vue'
  import ChatPanel from '../components/ChatPanel.vue'

  import LanguageSwitcher from '../components/LanguageSwitcher.vue'
  import { useTypedI18n } from '../composables/useI18n'
  import { useConferenceRoom } from '../composables/useConferenceRoom'
  import RemoteParticipant from '../components/RemoteParticipant.vue'
  import { useVideoGrid } from '../composables/useVideoGrid'

  const props = defineProps<{
    roomName: string
  }>()

  const { t } = useTypedI18n()
  const conference = useConferenceRoom()
  const userName = (Math.random() + 1).toString(36).substring(7)
  const initalsUserName = userName.slice(0, 2).toUpperCase()
  const localVideoRef = ref<HTMLVideoElement>()
  const screenShareRef = ref<HTMLVideoElement>()
  const isActuallyMuted = computed(
    () => !conference.isAudioEnabled.value || conference.isAudioMuted.value
  )

  watch(
    screenShareRef,
    (videoElement) => {
      if (videoElement && conference.screenStream.value) {
        videoElement.srcObject = conference.screenStream.value
        videoElement.play().catch((e) => console.debug('Screen share video play failed:', e))
      }
    },
    { immediate: true }
  )

  // Watch for screen stream changes
  watch(
    () => conference.screenStream.value,
    (stream) => {
      if (stream && screenShareRef.value) {
        screenShareRef.value.srcObject = stream
        screenShareRef.value
          .play()
          .catch((e) => console.debug('Screen share video play failed:', e))
      } else if (screenShareRef.value) {
        screenShareRef.value.srcObject = null
      }
    },
    { immediate: true }
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

  const handleToggleScreenShare = async () => {
    try {
      await conference.toggleScreenShare()
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
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

    <div v-if="conference.isScreenSharing.value" class="screen-share-container">
      <div class="screen-share-header">
        <h3>{{ displayName }} {{ t('room.screenShare.sharing') }}</h3>
        <button class="stop-share-btn" @click="handleToggleScreenShare">
          {{ t('room.screenShare.stop') }}
        </button>
      </div>
      <video ref="screenShareRef" autoplay playsinline class="screen-share-video" />
    </div>

    <div class="main-container">
      <div
        class="video-grid"
        :class="{ 'with-screen-share': conference.isScreenSharing.value }"
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
                  conference.localStream.value && conference.isVideoEnabled.value
                    ? 'block'
                    : 'none',
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
      <ChatPanel
        v-if="conference.chat.value && conference.currentRoom.value"
        :chat="conference.chat.value"
        :room-name="conference.currentRoom.value"
      />
    </div>

    <footer class="room-controls">
      <ConferenceControls
        v-if="conference.currentRoom && !conference.joinError.value"
        :is-muted="isActuallyMuted"
        :is-video-off="!conference.isVideoEnabled"
        :is-presenting="conference.isScreenSharing.value"
        @toggle-video="handleToggleVideo"
        @toggle-audio="handleToggleAudio"
        @toggle-screen-share="handleToggleScreenShare"
      />
    </footer>
  </section>
</template>

<style scoped>
  .main-container {
    display: grid;
    grid-template-columns: 1fr 350px;
    height: 100%;
    overflow: hidden;
  }
  .screen-share-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: #000;
  }

  .screen-share-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .screen-share-header h3 {
    margin: 0;
    color: white;
    font-size: 1rem;
    font-weight: 500;
  }

  .stop-share-btn {
    background: #ea4335;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .stop-share-btn:hover {
    background: #d33b2c;
  }

  .screen-share-video {
    flex: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
    border-radius: 8px;
  }

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

  .video-grid.with-screen-share {
    /* When screen sharing is active, make video grid smaller */
    display: flex;
    flex: 0 0 200px;
    padding: 8px;
    gap: 4px;
    /* Force single row for participants when screen sharing */
    grid-template-rows: 1fr;
  }

  .video-slot {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: var(--aspect-ratio);
    max-height: 100%;
  }

  .video-grid.with-screen-share .video-slot {
    width: auto;
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
    .main-container {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 200px;
    }
    .video-grid {
      padding: 8px;
      gap: 4px;
    }

    .video-grid.with-screen-share {
      flex: 0 0 150px;
    }

    .screen-share-container {
      padding: 8px;
    }

    .screen-share-header {
      padding: 8px 12px;
      margin-bottom: 8px;
    }

    .screen-share-header h3 {
      font-size: 0.9rem;
    }

    .stop-share-btn {
      padding: 6px 12px;
      font-size: 12px;
    }

    .room-header {
      padding: 0.5rem;
    }

    .room-header h1 {
      font-size: 1.25rem;
    }
  }
</style>

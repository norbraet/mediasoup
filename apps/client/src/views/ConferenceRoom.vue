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

  // Check if screen sharing is active
  const hasScreenShare = computed(() => {
    return Array.from(conference.participants.value.values()).some((participant) =>
      participant.userName.includes(' - Screen Share')
    )
  })

  // Use video grid composable for dynamic layout (only when no screen share)
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

    <div class="main-container">
      <!-- Screen Share Layout -->
      <div v-if="hasScreenShare" class="screen-share-layout">
        <!-- Main Screen Share Area -->
        <div class="screen-share-main">
          <div
            v-for="participant in Array.from(conference.participants.value.values())"
            v-show="participant.userName.includes(' - Screen Share')"
            :key="participant.userId"
            class="screen-share-video"
          >
            <RemoteParticipant :participant="participant" />
          </div>
        </div>

        <!-- Participants Thumbnails Row -->
        <div class="participants-thumbnails">
          <!-- Local Video Thumbnail -->
          <div class="thumbnail-slot">
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

          <!-- Remote Participants Thumbnails (exclude screen share) -->
          <div
            v-for="participant in Array.from(conference.participants.value.values()).filter(
              (p) => !p.userName.includes(' - Screen Share')
            )"
            :key="participant.userId"
            class="thumbnail-slot"
            :class="{ 'active-speaker': participant.isActiveSpeaker }"
          >
            <RemoteParticipant :participant="participant" />
          </div>
        </div>
      </div>

      <!-- Regular Grid Layout (no screen share) -->
      <div
        v-else
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
          :class="{
            'active-speaker': participant.isActiveSpeaker,
          }"
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
        :is-presenting="conference.isScreenShareActive.value"
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
    overflow: scroll;
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
    gap: 0.5rem;
    padding: 1rem;
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

  /* ===== SCREEN SHARE LAYOUT ===== */
  .screen-share-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
    padding: 16px;
  }

  .screen-share-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    gap: 1rem;
  }

  .screen-share-video {
    width: 100%;
    height: 100%;
    max-height: 100%;
  }

  .screen-share-video .video-container {
    border: 3px solid #1976d2;
    box-shadow: 0 0 20px rgba(25, 118, 210, 0.4);
    animation: screenShareGlow 3s ease-in-out infinite;
  }

  .screen-share-video .participant-video {
    transform: none;
    object-fit: contain;
  }

  .screen-share-video .participant-label {
    background: rgba(25, 118, 210, 0.9);
    color: white;
    font-weight: 600;
    padding: 8px 16px;
    font-size: 14px;
  }

  /* Participants Thumbnails Row */
  .participants-thumbnails {
    display: flex;
    gap: 0.5rem;
    height: 120px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 0;
    flex-shrink: 0;
  }

  .thumbnail-slot {
    flex: 0 0 160px;
    height: 100%;
    min-width: 160px;
  }

  .thumbnail-slot .video-container {
    border: 2px solid #3d3d3d;
    border-radius: 8px;
  }

  .thumbnail-slot .participant-video {
    border-radius: 6px;
  }

  .thumbnail-slot .participant-label {
    font-size: 10px;
    padding: 2px 6px;
    bottom: 4px;
    left: 4px;
  }

  .thumbnail-slot .no-video-placeholder .placeholder-text {
    font-size: 2rem;
  }

  .thumbnail-slot.active-speaker .video-container {
    border: 2px solid #34a853;
    box-shadow: 0 0 8px rgba(52, 168, 83, 0.3);
  }

  /* Screen share glowing effect */
  @keyframes screenShareGlow {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(25, 118, 210, 0.4);
      border-color: #1976d2;
    }
    50% {
      box-shadow: 0 0 28px rgba(25, 118, 210, 0.6);
      border-color: #2196f3;
    }
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

  /* Mobile adjustments for screen share layout */
  @media (max-width: 768px) {
    .screen-share-layout {
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .participants-thumbnails {
      height: 80px;
    }

    .thumbnail-slot {
      flex: 0 0 100px;
      min-width: 100px;
    }

    .thumbnail-slot .no-video-placeholder .placeholder-text {
      font-size: 1.5rem;
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
      padding: 0.5rem;
      gap: 0.25rem;
    }

    .room-header {
      padding: 0.5rem;
    }

    .room-header h1 {
      font-size: 1.25rem;
    }
  }
</style>

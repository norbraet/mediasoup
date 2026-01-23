<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import type { RoomParticipant } from '../types/types'

  const props = defineProps<{
    participant: RoomParticipant
  }>()

  const initalParticipantsUserName = props.participant.userName.slice(0, 2).toUpperCase()
  const videoRef = ref<HTMLVideoElement>()
  const isAudioActive = ref(false)

  const tryPlayVideo = () => {
    if (videoRef.value) {
      videoRef.value.play().catch((_e) => {
        // console.debug('Autoplay failed, user interaction needed:', e)
      })
    }
  }

  onMounted(() => {
    if (props.participant.videoTrack && videoRef.value) {
      const videoStream = new MediaStream([props.participant.videoTrack])
      videoRef.value.srcObject = videoStream

      // Try to play the video with multiple attempts
      tryPlayVideo()
      setTimeout(tryPlayVideo, 500)
      setTimeout(tryPlayVideo, 2000)
    }
  })

  // Watch for track changes
  watch(
    () => props.participant.videoTrack,
    (newTrack) => {
      if (newTrack && videoRef.value) {
        const videoStream = new MediaStream([newTrack])
        videoRef.value.srcObject = videoStream
        tryPlayVideo()
      }
    }
  )

  // Optional: Audio level detection for visual feedback
  watch(
    () => props.participant.audioTrack,
    (audioTrack) => {
      // You could add audio level detection here later
      isAudioActive.value = !!audioTrack
    }
  )
</script>

<template>
  <div class="video-container">
    <video
      :id="`remote-video-${participant.userId}`"
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="participant-video"
      :style="{ display: participant.videoTrack ? 'block' : 'none' }"
    />
    <div v-if="!participant.videoTrack" class="no-video-placeholder">
      <div class="placeholder-text">{{ initalParticipantsUserName }}</div>
    </div>
    <div class="participant-label">{{ participant.userName }}</div>
    <div v-if="isAudioActive" class="audio-indicator active">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
        />
      </svg>
    </div>
    <div v-else class="audio-indicator muted">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 9.01 10.28v.43c0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3zM11.98 5.17c-.06-.06-.15-.11-.22-.11-.22 0-.4.18-.4.4v1.19l5.3 5.3c.26-.6.37-1.23.37-1.95v-6c0-1.66-1.34-3-3-3-.17 0-.33.02-.49.05z"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
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

  .audio-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .audio-indicator.active {
    background: rgba(52, 168, 83, 0.8); /* Green for active */
  }

  .audio-indicator.muted {
    background: rgba(234, 67, 53, 0.8); /* Red for muted */
  }

  .audio-indicator svg {
    width: 16px;
    height: 16px;
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
</style>

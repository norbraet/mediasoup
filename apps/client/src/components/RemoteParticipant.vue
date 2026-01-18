<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import type { RoomParticipant } from '../types/types'

  const props = defineProps<{
    participant: RoomParticipant
  }>()

  const videoRef = ref<HTMLVideoElement>()
  const isAudioActive = ref(false)

  onMounted(() => {
    if (props.participant.videoTrack && videoRef.value) {
      const videoStream = new MediaStream([props.participant.videoTrack])
      videoRef.value.srcObject = videoStream
    }
  })

  // Watch for track changes
  watch(
    () => props.participant.videoTrack,
    (newTrack) => {
      if (newTrack && videoRef.value) {
        const videoStream = new MediaStream([newTrack])
        videoRef.value.srcObject = videoStream
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
  <div class="remote-participant">
    <video
      :id="`remote-video-${participant.userId}`"
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="remote-video"
    />
    <div class="participant-name">{{ participant.userName }}</div>
    <div v-if="isAudioActive" class="audio-indicator active">Audio On</div>
  </div>
</template>

<style scoped>
  .remote-participant {
    position: relative;
    width: 300px;
    height: 200px;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
  }

  .remote-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .participant-name {
    position: absolute;
    bottom: 8px;
    left: 8px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .audio-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px;
    border-radius: 4px;
    opacity: 0.5;
  }

  .audio-indicator.active {
    opacity: 1;
  }
</style>

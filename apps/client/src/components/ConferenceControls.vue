<script setup lang="ts">
  import { useTypedI18n } from '../composables/useI18n'
  import { Circle, Mic, MicOffIcon, ScreenShare, Video, VideoOff } from 'lucide-vue-next'
  import { ref, watch } from 'vue'

  const props = defineProps<{
    isMuted?: boolean
    isVideoOff?: boolean
    isPresenting?: boolean
    isRecording?: boolean
  }>()

  const emit = defineEmits<{
    'toggle-audio': [isNowMuted: boolean]
    'toggle-video': [isNowVideoOff: boolean]
    'toggle-screen-share': [isNowPresenting: boolean]
    'toggle-recording': [isNowRecording: boolean]
  }>()

  const iconSize = 24
  const { t } = useTypedI18n()

  // Local reactive state for immediate UI feedback
  const localMuted = ref(props.isMuted ?? false)
  const localVideoOff = ref(props.isVideoOff ?? false)
  const localPresenting = ref(props.isPresenting ?? false)
  const localRecording = ref(props.isRecording ?? false)

  // Watch for prop changes to sync with parent
  watch(
    () => props.isMuted,
    (newValue) => {
      if (newValue !== undefined) localMuted.value = newValue
    },
    { immediate: true }
  )

  watch(
    () => props.isVideoOff,
    (newValue) => {
      if (newValue !== undefined) localVideoOff.value = newValue
    },
    { immediate: true }
  )

  watch(
    () => props.isPresenting,
    (newValue) => {
      if (newValue !== undefined) localPresenting.value = newValue
    },
    { immediate: true }
  )

  watch(
    () => props.isRecording,
    (newValue) => {
      if (newValue !== undefined) localRecording.value = newValue
    },
    { immediate: true }
  )

  // Click handlers
  const handleToggleAudio = () => {
    localMuted.value = !localMuted.value
    emit('toggle-audio', localMuted.value)
  }

  const handleToggleVideo = () => {
    localVideoOff.value = !localVideoOff.value
    emit('toggle-video', localVideoOff.value)
  }

  const handleToggleScreenShare = () => {
    localPresenting.value = !localPresenting.value
    emit('toggle-screen-share', localPresenting.value)
  }

  const handleToggleRecording = () => {
    localRecording.value = !localRecording.value
    emit('toggle-recording', localRecording.value)
  }
</script>

<template>
  <div class="main-controls">
    <button
      class="control-btn"
      :class="{ inactive: localMuted, 'audio-off': localMuted }"
      :title="localMuted ? t('controls.audio.unmute') : t('controls.audio.mute')"
      @click="handleToggleAudio"
    >
      <Mic v-if="!localMuted" :size="iconSize" />
      <MicOffIcon v-else :size="iconSize" />
    </button>

    <button
      class="control-btn"
      :class="{ inactive: localVideoOff, 'video-off': localVideoOff }"
      :title="localVideoOff ? t('controls.video.turnOn') : t('controls.video.turnOff')"
      @click="handleToggleVideo"
    >
      <Video v-if="!localVideoOff" :size="iconSize" />
      <VideoOff v-else :size="iconSize" />
    </button>

    <button
      class="control-btn"
      :class="{ 'screen-sharing': localPresenting }"
      :title="localPresenting ? t('controls.screenShare.stop') : t('controls.screenShare.start')"
      @click="handleToggleScreenShare"
    >
      <ScreenShare :size="iconSize" />
    </button>

    <button
      class="control-btn"
      :class="{ 'recording-active': localRecording }"
      :title="localRecording ? t('controls.recording.stop') : t('controls.recording.start')"
      @click="handleToggleRecording"
    >
      <Circle :size="iconSize" />
    </button>
  </div>
</template>

<style scoped>
  .main-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 1rem;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    border: none;
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: 0 2px 6px var(--color-shadow-primary);
  }

  .control-btn:hover {
    background-color: var(--color-bg-secondary-hover);
  }

  /* Muted/Off states - Using global error color */
  .control-btn.inactive.audio-off,
  .control-btn.inactive.video-off {
    background-color: var(--color-error);
    color: #ffffff;
  }

  .control-btn.inactive.audio-off:hover,
  .control-btn.inactive.video-off:hover {
    background-color: var(--color-error-hover);
  }

  /* Screen sharing active - Using global primary color */
  .control-btn.screen-sharing {
    background-color: var(--color-primary);
    color: #ffffff;
  }

  .control-btn.screen-sharing:hover {
    filter: brightness(85%);
  }

  /* Recording active - Using global error color */
  .control-btn.recording-active {
    background-color: var(--color-error);
    color: #ffffff;
    animation: recording-pulse 2s ease-in-out infinite;
  }

  .control-btn.recording-active:hover {
    filter: brightness(85%);
  }

  /* Recording pulse animation - theme-aware shadows */
  @keyframes recording-pulse {
    0%,
    100% {
      box-shadow:
        0 2px 6px var(--color-shadow-primary),
        0 0 0 0 rgba(234, 67, 53, 0.4);
    }
    50% {
      box-shadow:
        0 2px 6px var(--color-shadow-primary),
        0 0 0 8px rgba(234, 67, 53, 0);
    }
  }

  /* Focus states for accessibility */
  .control-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .main-controls {
      gap: 8px;
      padding: 12px 16px;
    }

    .control-btn {
      width: 48px;
      height: 48px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .main-controls {
      border-width: 2px;
    }

    .control-btn {
      border: 1px solid var(--color-text-primary);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .control-btn,
    .main-controls {
      transition: none;
    }

    .control-btn:hover {
      transform: none;
    }

    .control-btn.recording-active {
      animation: none;
    }
  }
</style>

<template>
  <div
    class="video-participant"
    :class="{
      'is-main': isMain,
      'is-pinned': isPinned,
      'is-speaking': isSpeaking,
      'is-muted': participant.isAudioMuted,
      'video-off': participant.isVideoOff,
    }"
    @click="handleClick"
    @contextmenu="handleRightClick"
  >
    <!-- Video Element -->
    <video
      v-if="!participant.isVideoOff"
      ref="videoEl"
      :srcObject="participant.stream"
      autoplay
      playsinline
      muted
      class="participant-video"
    />

    <!-- Avatar when video is off -->
    <div v-else class="video-placeholder">
      <div class="avatar">
        {{ getInitials(participant.name) }}
      </div>
    </div>

    <!-- Participant Info Overlay -->
    <div class="participant-overlay">
      <!-- Name Label -->
      <div class="name-label">
        <span class="name">{{ displayName }}</span>
        <div class="status-indicators">
          <SimpleIcon v-if="participant.isHost" name="crown" class="host-icon" />
          <SimpleIcon v-if="participant.isPresenting" name="screen-share" class="presenting-icon" />
        </div>
      </div>

      <!-- Audio/Video Status -->
      <div class="media-status">
        <div
          v-if="participant.isAudioMuted"
          class="status-icon muted"
          :title="`${participant.name} is muted`"
        >
          <SimpleIcon name="mic-off" />
        </div>

        <div
          v-if="participant.isVideoOff"
          class="status-icon video-off"
          :title="`${participant.name}'s camera is off`"
        >
          <SimpleIcon name="video-off" />
        </div>
      </div>

      <!-- Connection Quality Indicator -->
      <div class="connection-quality" :class="`quality-${connectionQuality}`">
        <div class="signal-bars">
          <div class="bar" :class="{ active: connectionQuality >= 1 }"></div>
          <div class="bar" :class="{ active: connectionQuality >= 2 }"></div>
          <div class="bar" :class="{ active: connectionQuality >= 3 }"></div>
          <div class="bar" :class="{ active: connectionQuality >= 4 }"></div>
        </div>
      </div>

      <!-- Pin/Menu Button -->
      <div v-if="!isMain" class="participant-actions">
        <button
          class="action-btn pin-btn"
          :class="{ active: isPinned }"
          :title="isPinned ? 'Unpin' : 'Pin participant'"
          @click.stop="$emit('pin', participant.id)"
        >
          <SimpleIcon name="pin" />
        </button>

        <button class="action-btn menu-btn" title="More options" @click.stop="handleMenuClick">
          <SimpleIcon name="more-vertical" />
        </button>
      </div>
    </div>

    <!-- Speaking Indicator -->
    <div
      v-if="isSpeaking && !participant.isAudioMuted"
      class="speaking-indicator"
      :style="{
        animationDuration: `${speakingIntensity * 0.5 + 0.5}s`,
      }"
    ></div>

    <!-- Screen Share Label -->
    <div v-if="participant.isPresenting" class="screen-share-label">
      <SimpleIcon name="screen-share" />
      <span>{{ participant.name }}'s screen</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted, onUnmounted } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  interface Participant {
    id: string
    name: string
    isAudioMuted: boolean
    isVideoOff: boolean
    isPresenting: boolean
    isHost: boolean
    stream?: MediaStream
  }

  const props = defineProps<{
    participant: Participant
    isMain: boolean
    isPinned: boolean
  }>()

  const emit = defineEmits<{
    pin: [id: string]
    'toggle-menu': [data: { participant: Participant; position: { x: number; y: number } }]
  }>()

  // State
  // const videoEl = ref<HTMLVideoElement>()
  const isSpeaking = ref(false)
  const speakingIntensity = ref(0)
  const connectionQuality = ref(4) // 1-4, 4 being best

  // Mock speaking detection
  let speakingInterval: number | null = null

  onMounted(() => {
    // Mock speaking animation
    speakingInterval = setInterval(() => {
      if (!props.participant.isAudioMuted && Math.random() > 0.8) {
        isSpeaking.value = true
        speakingIntensity.value = Math.random()
        setTimeout(
          () => {
            isSpeaking.value = false
          },
          1000 + Math.random() * 2000
        )
      }
    }, 2000) as unknown as number

    // Mock connection quality changes
    setInterval(() => {
      connectionQuality.value = Math.floor(Math.random() * 4) + 1
    }, 10000)
  })

  onUnmounted(() => {
    if (speakingInterval) {
      clearInterval(speakingInterval)
    }
  })

  // Computed
  const displayName = computed(() => {
    if (props.participant.id === 'user-1') return 'You'
    return props.participant.name
  })

  // Methods
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleClick = () => {
    if (!props.isMain) {
      emit('pin', props.participant.id)
    }
  }

  const handleRightClick = (event: MouseEvent) => {
    event.preventDefault()
    handleMenuClick(event)
  }

  const handleMenuClick = (event?: MouseEvent) => {
    const rect = (event?.target as Element)?.getBoundingClientRect() ?? { x: 0, y: 0 }
    emit('toggle-menu', {
      participant: props.participant,
      position: { x: rect.x, y: rect.y },
    })
  }
</script>

<style scoped>
  .video-participant {
    position: relative;
    background: #2d2d2d;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    min-height: 120px;
  }

  .video-participant:hover {
    border-color: #5f6368;
  }

  .video-participant.is-speaking {
    border-color: #34a853;
    box-shadow: 0 0 0 2px rgba(52, 168, 83, 0.3);
  }

  .video-participant.is-pinned {
    border-color: #1a73e8;
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.3);
  }

  .video-participant.is-main {
    cursor: default;
    min-height: 200px;
  }

  .participant-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #1a1a1a;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 500;
    color: white;
    backdrop-filter: blur(10px);
  }

  .is-main .avatar {
    width: 120px;
    height: 120px;
    font-size: 36px;
  }

  .participant-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: end;
  }

  .name-label {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
  }

  .name {
    color: white;
    font-size: 14px;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
  }

  .is-main .name {
    font-size: 16px;
    max-width: 200px;
  }

  .status-indicators {
    display: flex;
    gap: 4px;
  }

  .host-icon {
    color: #fbbc04;
    width: 16px;
    height: 16px;
  }

  .presenting-icon {
    color: #34a853;
    width: 16px;
    height: 16px;
  }

  .media-status {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .status-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .status-icon.muted {
    background: #ea4335;
    color: white;
  }

  .status-icon.video-off {
    background: #5f6368;
    color: white;
  }

  .connection-quality {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0.7;
  }

  .signal-bars {
    display: flex;
    gap: 1px;
    align-items: end;
  }

  .bar {
    width: 2px;
    background: rgba(255, 255, 255, 0.3);
    transition: background-color 0.2s;
  }

  .bar:nth-child(1) {
    height: 4px;
  }
  .bar:nth-child(2) {
    height: 6px;
  }
  .bar:nth-child(3) {
    height: 8px;
  }
  .bar:nth-child(4) {
    height: 10px;
  }

  .bar.active {
    background: white;
  }

  .quality-1 .bar.active {
    background: #ea4335;
  }
  .quality-2 .bar.active {
    background: #fbbc04;
  }
  .quality-3 .bar.active {
    background: #34a853;
  }
  .quality-4 .bar.active {
    background: #34a853;
  }

  .participant-actions {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .video-participant:hover .participant-actions {
    opacity: 1;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
  }

  .action-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .pin-btn.active {
    background: #1a73e8;
    color: white;
  }

  .speaking-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 3px solid #34a853;
    border-radius: 8px;
    animation: pulse 1s ease-in-out infinite;
    pointer-events: none;
  }

  .screen-share-label {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    backdrop-filter: blur(10px);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(0.98);
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .avatar {
      width: 60px;
      height: 60px;
      font-size: 18px;
    }

    .name {
      font-size: 12px;
      max-width: 80px;
    }

    .participant-overlay {
      padding: 8px;
    }

    .action-btn {
      width: 24px;
      height: 24px;
      font-size: 10px;
    }
  }
</style>

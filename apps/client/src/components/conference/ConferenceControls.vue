<template>
  <div class="conference-controls">
    <div class="controls-container">
      <!-- Main Controls -->
      <div class="main-controls">
        <button
          class="control-btn"
          :class="{ active: !isMuted, muted: isMuted }"
          :title="isMuted ? 'Unmute microphone' : 'Mute microphone'"
          @click="$emit('toggle-audio')"
        >
          <SimpleIcon :name="isMuted ? 'mic-off' : 'mic'" />
        </button>

        <button
          class="control-btn"
          :class="{ active: !isVideoOff, 'video-off': isVideoOff }"
          :title="isVideoOff ? 'Turn on camera' : 'Turn off camera'"
          @click="$emit('toggle-video')"
        >
          <SimpleIcon :name="isVideoOff ? 'video-off' : 'video'" />
        </button>

        <button
          class="control-btn"
          :class="{ active: isPresenting }"
          :title="isPresenting ? 'Stop presenting' : 'Present screen'"
          @click="$emit('toggle-screen-share')"
        >
          <SimpleIcon name="screen-share" />
          <span v-if="isPresenting" class="control-label">Stop</span>
        </button>

        <button
          class="control-btn"
          :class="{ active: isRecording }"
          :title="isRecording ? 'Stop recording' : 'Start recording'"
          @click="$emit('toggle-recording')"
        >
          <SimpleIcon name="record" />
          <div v-if="isRecording" class="recording-indicator"></div>
        </button>
      </div>

      <!-- Secondary Controls -->
      <div class="secondary-controls">
        <div class="control-group">
          <button class="control-btn" title="Change layout" @click="toggleLayoutMenu">
            <SimpleIcon name="layout" />
          </button>

          <div v-if="showLayoutMenu" class="layout-menu">
            <button
              class="layout-option"
              :class="{ active: currentLayout === 'grid' }"
              @click="selectLayout('grid')"
            >
              <SimpleIcon name="grid" />
              <span>Grid</span>
            </button>

            <button
              class="layout-option"
              :class="{ active: currentLayout === 'speaker' }"
              @click="selectLayout('speaker')"
            >
              <SimpleIcon name="speaker" />
              <span>Speaker</span>
            </button>

            <button
              class="layout-option"
              :class="{ active: currentLayout === 'presentation' }"
              @click="selectLayout('presentation')"
            >
              <SimpleIcon name="presentation" />
              <span>Focus</span>
            </button>
          </div>
        </div>

        <button class="control-btn" title="Effects and filters" @click="openEffects">
          <SimpleIcon name="effects" />
        </button>

        <button class="control-btn" title="Settings" @click="openSettings">
          <SimpleIcon name="settings" />
        </button>

        <div class="control-group">
          <button class="control-btn" title="More options" @click="toggleMoreMenu">
            <SimpleIcon name="more-horizontal" />
          </button>

          <div v-if="showMoreMenu" class="more-menu">
            <button class="menu-item" @click="toggleCaptions">
              <SimpleIcon name="captions" />
              <span>Captions</span>
              <div v-if="captionsEnabled" class="toggle-indicator active"></div>
            </button>

            <button class="menu-item" @click="toggleWhiteboard">
              <SimpleIcon name="edit" />
              <span>Whiteboard</span>
            </button>

            <button class="menu-item" @click="toggleBreakoutRooms">
              <SimpleIcon name="users" />
              <span>Breakout rooms</span>
            </button>

            <button class="menu-item" @click="openPolls">
              <SimpleIcon name="poll" />
              <span>Polls</span>
            </button>

            <div class="menu-divider"></div>

            <button class="menu-item" @click="reportIssue">
              <SimpleIcon name="flag" />
              <span>Report issue</span>
            </button>

            <button class="menu-item" @click="openKeyboardShortcuts">
              <SimpleIcon name="keyboard" />
              <span>Keyboard shortcuts</span>
            </button>
          </div>
        </div>
      </div>

      <!-- End Call -->
      <div class="end-call-controls">
        <button class="control-btn end-call-btn" title="Leave meeting" @click="confirmEndCall">
          <SimpleIcon name="phone-off" />
        </button>
      </div>
    </div>

    <!-- Meeting Timer -->
    <div class="meeting-timer">
      {{ meetingDuration }}
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  defineProps<{
    isMuted: boolean
    isVideoOff: boolean
    isPresenting: boolean
    isRecording: boolean
  }>()

  const emit = defineEmits<{
    'toggle-audio': []
    'toggle-video': []
    'toggle-screen-share': []
    'toggle-recording': []
    'change-layout': [layout: 'grid' | 'speaker' | 'presentation']
  }>()

  // State
  const showLayoutMenu = ref(false)
  const showMoreMenu = ref(false)
  const currentLayout = ref<'grid' | 'speaker' | 'presentation'>('grid')
  const captionsEnabled = ref(false)
  const meetingStartTime = ref(Date.now())

  // Timer
  let timerInterval: number | null = null

  const meetingDuration = computed(() => {
    const now = Date.now()
    const elapsed = now - meetingStartTime.value
    const hours = Math.floor(elapsed / (1000 * 60 * 60))
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  onMounted(() => {
    // Update timer every second
    timerInterval = setInterval(() => {
      // Force reactivity update
      meetingStartTime.value = meetingStartTime.value
    }, 1000) as unknown as number

    // Close menus when clicking outside
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    if (timerInterval) {
      clearInterval(timerInterval)
    }
    document.removeEventListener('click', handleClickOutside)
  })

  // Methods
  const handleClickOutside = (event: Event) => {
    const target = event.target as Element
    if (!target.closest('.control-group')) {
      showLayoutMenu.value = false
      showMoreMenu.value = false
    }
  }

  const toggleLayoutMenu = () => {
    showLayoutMenu.value = !showLayoutMenu.value
    showMoreMenu.value = false
  }

  const toggleMoreMenu = () => {
    showMoreMenu.value = !showMoreMenu.value
    showLayoutMenu.value = false
  }

  const selectLayout = (layout: 'grid' | 'speaker' | 'presentation') => {
    currentLayout.value = layout
    emit('change-layout', layout)
    showLayoutMenu.value = false
  }

  const openEffects = () => {
    // TODO: Open effects panel
    console.log('Open effects')
  }

  const openSettings = () => {
    // TODO: Open settings modal
    console.log('Open settings')
  }

  const toggleCaptions = () => {
    captionsEnabled.value = !captionsEnabled.value
    showMoreMenu.value = false
  }

  const toggleWhiteboard = () => {
    // TODO: Toggle whiteboard
    console.log('Toggle whiteboard')
    showMoreMenu.value = false
  }

  const toggleBreakoutRooms = () => {
    // TODO: Toggle breakout rooms
    console.log('Toggle breakout rooms')
    showMoreMenu.value = false
  }

  const openPolls = () => {
    // TODO: Open polls
    console.log('Open polls')
    showMoreMenu.value = false
  }

  const reportIssue = () => {
    // TODO: Open issue reporting
    console.log('Report issue')
    showMoreMenu.value = false
  }

  const openKeyboardShortcuts = () => {
    // TODO: Show keyboard shortcuts
    console.log('Show keyboard shortcuts')
    showMoreMenu.value = false
  }

  const confirmEndCall = () => {
    if (confirm('Are you sure you want to leave this meeting?')) {
      // TODO: Leave meeting
      console.log('Leave meeting')
    }
  }
</script>

<style scoped>
  .conference-controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .controls-container {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 50px;
    padding: 12px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .main-controls,
  .secondary-controls,
  .end-call-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .secondary-controls {
    gap: 12px;
  }

  .control-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    font-size: 18px;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .control-btn.active {
    background: #1a73e8;
  }

  .control-btn.muted {
    background: #ea4335;
  }

  .control-btn.video-off {
    background: #ea4335;
  }

  .end-call-btn {
    background: #ea4335;
    width: 56px;
    height: 56px;
  }

  .end-call-btn:hover {
    background: #d33b2c;
  }

  .control-label {
    position: absolute;
    bottom: -20px;
    font-size: 10px;
    white-space: nowrap;
    color: white;
  }

  .recording-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    background: #ea4335;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .control-group {
    position: relative;
  }

  .layout-menu,
  .more-menu {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 150px;
  }

  .layout-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
    font-size: 14px;
  }

  .layout-option:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .layout-option.active {
    background: #1a73e8;
  }

  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
    font-size: 14px;
    text-align: left;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .toggle-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transition: background-color 0.2s;
  }

  .toggle-indicator.active {
    background: #34a853;
  }

  .meeting-timer {
    color: white;
    font-size: 12px;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 12px;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  }

  /* Animations */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .controls-container {
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 20px;
    }

    .control-btn {
      width: 40px;
      height: 40px;
      font-size: 16px;
    }

    .end-call-btn {
      width: 44px;
      height: 44px;
    }

    .secondary-controls {
      gap: 8px;
    }

    .layout-menu,
    .more-menu {
      min-width: 120px;
      font-size: 12px;
    }

    .meeting-timer {
      font-size: 11px;
    }
  }

  @media (max-width: 480px) {
    .conference-controls {
      bottom: 10px;
    }

    .controls-container {
      gap: 4px;
      padding: 6px 8px;
    }

    .control-btn {
      width: 36px;
      height: 36px;
      font-size: 14px;
    }

    .end-call-btn {
      width: 40px;
      height: 40px;
    }

    .main-controls,
    .secondary-controls {
      gap: 4px;
    }
  }
</style>

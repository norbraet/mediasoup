<template>
  <div class="participants-list">
    <div class="list-header">
      <h3>In this meeting</h3>
      <span class="participant-count">{{ participants.length }}</span>
    </div>

    <div class="participants-container">
      <div
        v-for="participant in participants"
        :key="participant.id"
        class="participant-item"
        :class="{ 'is-you': participant.id === currentUserId }"
      >
        <!-- Avatar -->
        <div class="participant-avatar">
          {{ getInitials(participant.name) }}
          <div v-if="participant.isHost" class="host-badge" title="Host">
            <SimpleIcon name="crown" />
          </div>
        </div>

        <!-- Info -->
        <div class="participant-info">
          <div class="participant-name">
            {{ participant.id === currentUserId ? 'You' : participant.name }}
            <span v-if="participant.isHost" class="host-label">(Host)</span>
            <span v-if="participant.isPresenting" class="presenting-label">(Presenting)</span>
          </div>

          <!-- Status indicators -->
          <div class="participant-status">
            <span v-if="participant.isAudioMuted" class="status-badge muted">
              <SimpleIcon name="mic-off" />
              Muted
            </span>
            <span v-if="participant.isVideoOff" class="status-badge video-off">
              <SimpleIcon name="video-off" />
              Camera off
            </span>
            <span v-if="isParticipantSpeaking(participant.id)" class="status-badge speaking">
              <SimpleIcon name="volume" />
              Speaking
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="participant-actions">
          <button
            v-if="canPinParticipant(participant)"
            class="action-btn"
            :title="`Pin ${participant.name}`"
            @click="pinParticipant(participant.id)"
          >
            <SimpleIcon name="pin" />
          </button>

          <button
            v-if="canMuteParticipant(participant)"
            class="action-btn"
            :class="{ active: !participant.isAudioMuted }"
            :title="
              participant.isAudioMuted
                ? `Ask ${participant.name} to unmute`
                : `Mute ${participant.name}`
            "
            @click="toggleMute(participant)"
          >
            <SimpleIcon :name="participant.isAudioMuted ? 'mic-off' : 'mic'" />
          </button>

          <div class="action-group">
            <button
              class="action-btn menu-btn"
              :title="'More options'"
              @click="toggleParticipantMenu(participant)"
            >
              <SimpleIcon name="more-vertical" />
            </button>

            <div v-if="showMenuFor === participant.id" class="participant-menu" @click.stop>
              <button
                v-if="canPrivateMessage(participant)"
                class="menu-item"
                @click="sendPrivateMessage(participant)"
              >
                <SimpleIcon name="message-circle" />
                <span>Send private message</span>
              </button>

              <button
                v-if="canSpotlight(participant)"
                class="menu-item"
                @click="spotlightParticipant(participant)"
              >
                <SimpleIcon name="spotlight" />
                <span>Spotlight for everyone</span>
              </button>

              <button
                v-if="canMoveToBreakout(participant)"
                class="menu-item"
                @click="moveToBreakout(participant)"
              >
                <SimpleIcon name="users" />
                <span>Move to breakout room</span>
              </button>

              <div v-if="isHost && participant.id !== currentUserId" class="menu-divider"></div>

              <button
                v-if="canMakeHost(participant)"
                class="menu-item"
                @click="makeHost(participant)"
              >
                <SimpleIcon name="crown" />
                <span>Make host</span>
              </button>

              <button
                v-if="canRemoveParticipant(participant)"
                class="menu-item danger"
                @click="removeParticipant(participant)"
              >
                <SimpleIcon name="user-x" />
                <span>Remove from meeting</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Invite section -->
      <div class="invite-section">
        <button class="invite-btn" @click="openInviteDialog">
          <SimpleIcon name="user-plus" />
          <span>Invite others</span>
        </button>
      </div>
    </div>

    <!-- Host Controls -->
    <div v-if="isHost" class="host-controls">
      <div class="control-section">
        <h4>Host Controls</h4>

        <button class="control-item" @click="muteAll">
          <SimpleIcon name="mic-off" />
          <span>Mute all</span>
          <span class="shortcut">Ctrl+Alt+M</span>
        </button>

        <button class="control-item" @click="unmuteAll">
          <SimpleIcon name="mic" />
          <span>Unmute all</span>
        </button>

        <button class="control-item" @click="turnOffAllCameras">
          <SimpleIcon name="video-off" />
          <span>Turn off all cameras</span>
        </button>

        <button class="control-item" @click="lockMeeting">
          <SimpleIcon name="lock" />
          <span>{{ meetingLocked ? 'Unlock' : 'Lock' }} meeting</span>
        </button>

        <button class="control-item" @click="enableWaitingRoom">
          <SimpleIcon name="clock" />
          <span>{{ waitingRoomEnabled ? 'Disable' : 'Enable' }} waiting room</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
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
    participants: Participant[]
    currentUserId: string
  }>()

  const emit = defineEmits<{
    'mute-participant': [id: string]
    'remove-participant': [id: string]
  }>()

  // State
  const showMenuFor = ref<string | null>(null)
  const speakingParticipants = ref<Set<string>>(new Set())
  const meetingLocked = ref(false)
  const waitingRoomEnabled = ref(false)

  // Mock speaking detection
  let speakingInterval: number | null = null

  onMounted(() => {
    // Mock speaking detection
    speakingInterval = setInterval(() => {
      const randomParticipant =
        props.participants[Math.floor(Math.random() * props.participants.length)]
      if (randomParticipant && !randomParticipant.isAudioMuted && Math.random() > 0.7) {
        speakingParticipants.value.add(randomParticipant.id)
        setTimeout(() => {
          speakingParticipants.value.delete(randomParticipant.id)
        }, 2000)
      }
    }, 3000) as unknown as number

    // Close menu when clicking outside
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    if (speakingInterval) {
      clearInterval(speakingInterval)
    }
    document.removeEventListener('click', handleClickOutside)
  })

  // Computed
  const isHost = computed(() => {
    const currentUser = props.participants.find((p) => p.id === props.currentUserId)
    return currentUser?.isHost || false
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

  const isParticipantSpeaking = (id: string) => {
    return speakingParticipants.value.has(id)
  }

  const handleClickOutside = () => {
    showMenuFor.value = null
  }

  const toggleParticipantMenu = (participant: Participant) => {
    showMenuFor.value = showMenuFor.value === participant.id ? null : participant.id
  }

  // Permission checks
  const canPinParticipant = (participant: Participant) => {
    return participant.id !== props.currentUserId
  }

  const canMuteParticipant = (participant: Participant) => {
    return isHost.value || participant.id === props.currentUserId
  }

  const canPrivateMessage = (participant: Participant) => {
    return participant.id !== props.currentUserId
  }

  const canSpotlight = (participant: Participant) => {
    return isHost.value && participant.id !== props.currentUserId
  }

  const canMoveToBreakout = (participant: Participant) => {
    return isHost.value && participant.id !== props.currentUserId
  }

  const canMakeHost = (participant: Participant) => {
    return isHost.value && participant.id !== props.currentUserId && !participant.isHost
  }

  const canRemoveParticipant = (participant: Participant) => {
    return isHost.value && participant.id !== props.currentUserId
  }

  // Actions
  const pinParticipant = (id: string) => {
    console.log('Pin participant:', id)
    showMenuFor.value = null
  }

  const toggleMute = (participant: Participant) => {
    emit('mute-participant', participant.id)
    showMenuFor.value = null
  }

  const sendPrivateMessage = (participant: Participant) => {
    console.log('Send private message to:', participant.name)
    showMenuFor.value = null
  }

  const spotlightParticipant = (participant: Participant) => {
    console.log('Spotlight participant:', participant.name)
    showMenuFor.value = null
  }

  const moveToBreakout = (participant: Participant) => {
    console.log('Move to breakout room:', participant.name)
    showMenuFor.value = null
  }

  const makeHost = (participant: Participant) => {
    if (confirm(`Make ${participant.name} the host?`)) {
      console.log('Make host:', participant.name)
    }
    showMenuFor.value = null
  }

  const removeParticipant = (participant: Participant) => {
    if (confirm(`Remove ${participant.name} from the meeting?`)) {
      emit('remove-participant', participant.id)
    }
    showMenuFor.value = null
  }

  const openInviteDialog = () => {
    console.log('Open invite dialog')
  }

  // Host controls
  const muteAll = () => {
    if (confirm('Mute all participants?')) {
      console.log('Mute all participants')
    }
  }

  const unmuteAll = () => {
    console.log('Unmute all participants')
  }

  const turnOffAllCameras = () => {
    if (confirm('Turn off all participant cameras?')) {
      console.log('Turn off all cameras')
    }
  }

  const lockMeeting = () => {
    meetingLocked.value = !meetingLocked.value
    console.log('Meeting locked:', meetingLocked.value)
  }

  const enableWaitingRoom = () => {
    waitingRoomEnabled.value = !waitingRoomEnabled.value
    console.log('Waiting room enabled:', waitingRoomEnabled.value)
  }
</script>

<style scoped>
  .participants-list {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #2d2d2d;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #404040;
  }

  .list-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }

  .participant-count {
    background: #404040;
    color: #b3b3b3;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }

  .participants-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .participant-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    transition: background-color 0.2s;
    position: relative;
  }

  .participant-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .participant-item.is-you {
    background: rgba(26, 115, 232, 0.1);
  }

  .participant-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    color: white;
    position: relative;
    flex-shrink: 0;
  }

  .host-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    background: #fbbc04;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    border: 2px solid #2d2d2d;
  }

  .participant-info {
    flex: 1;
    min-width: 0;
  }

  .participant-name {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .host-label,
  .presenting-label {
    font-size: 11px;
    color: #b3b3b3;
    font-weight: normal;
  }

  .presenting-label {
    color: #34a853;
  }

  .participant-status {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    color: white;
  }

  .status-badge.muted {
    background: rgba(234, 67, 53, 0.2);
    color: #ea4335;
  }

  .status-badge.video-off {
    background: rgba(95, 99, 104, 0.2);
    color: #5f6368;
  }

  .status-badge.speaking {
    background: rgba(52, 168, 83, 0.2);
    color: #34a853;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .participant-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .participant-item:hover .participant-actions {
    opacity: 1;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .action-btn.active {
    background: #1a73e8;
  }

  .action-group {
    position: relative;
  }

  .participant-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 200px;
    z-index: 100;
  }

  .menu-item {
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
    font-size: 13px;
    text-align: left;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .menu-item.danger {
    color: #ea4335;
  }

  .menu-item.danger:hover {
    background: rgba(234, 67, 53, 0.1);
  }

  .menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .invite-section {
    padding: 12px;
    border-top: 1px solid #404040;
  }

  .invite-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: rgba(26, 115, 232, 0.1);
    border: 1px solid #1a73e8;
    color: #1a73e8;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
  }

  .invite-btn:hover {
    background: rgba(26, 115, 232, 0.2);
  }

  .host-controls {
    border-top: 1px solid #404040;
    padding: 16px;
  }

  .control-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #b3b3b3;
  }

  .control-item {
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
    font-size: 13px;
    text-align: left;
    margin-bottom: 2px;
  }

  .control-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .shortcut {
    font-size: 11px;
    color: #b3b3b3;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  /* Scrollbar styling */
  .participants-container::-webkit-scrollbar {
    width: 4px;
  }

  .participants-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .participants-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .participants-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>

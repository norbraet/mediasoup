<template>
  <div class="conference-room">
    <!-- Header -->
    <div class="conference-header">
      <div class="room-info">
        <h2 class="room-title">{{ roomName }}</h2>
        <span class="participant-count">{{ participants.length }} participants</span>
      </div>

      <div class="header-actions">
        <button class="btn btn-secondary" @click="toggleParticipants">
          <SimpleIcon name="people" />
          People ({{ participants.length }})
        </button>

        <button class="btn btn-secondary" @click="toggleChat">
          <SimpleIcon name="chat" />
          Chat
          <span v-if="unreadMessages > 0" class="badge">{{ unreadMessages }}</span>
        </button>

        <button class="btn btn-secondary" @click="openSettings">
          <SimpleIcon name="settings" />
        </button>

        <button class="btn btn-danger" @click="leaveRoom">End call</button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="conference-content" :class="{ 'sidebar-open': showSidebar }">
      <!-- Video Grid -->
      <div class="video-area">
        <VideoGrid
          :participants="participants"
          :layout="currentLayout"
          :pinned-participant="pinnedParticipant"
          @pin-participant="pinParticipant"
          @toggle-participant-menu="toggleParticipantMenu"
        />

        <!-- Floating Controls -->
        <ConferenceControls
          :is-muted="isMuted"
          :is-video-off="isVideoOff"
          :is-presenting="isPresenting"
          :is-recording="isRecording"
          @toggle-audio="toggleAudio"
          @toggle-video="toggleVideo"
          @toggle-screen-share="toggleScreenShare"
          @toggle-recording="toggleRecording"
          @change-layout="changeLayout"
        />
      </div>

      <!-- Sidebar -->
      <div v-if="showSidebar" class="sidebar">
        <div class="sidebar-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'participants' }"
            @click="activeTab = 'participants'"
          >
            People
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'chat' }"
            @click="activeTab = 'chat'"
          >
            Chat
            <span v-if="unreadMessages > 0" class="badge">{{ unreadMessages }}</span>
          </button>
        </div>

        <ParticipantsList
          v-if="activeTab === 'participants'"
          :participants="participants"
          :current-user-id="currentUserId"
          @mute-participant="muteParticipant"
          @remove-participant="removeParticipant"
        />

        <ChatPanel
          v-if="activeTab === 'chat'"
          :messages="chatMessages"
          :current-user-id="currentUserId"
          @send-message="sendMessage"
        />
      </div>
    </div>

    <!-- Modals -->
    <SettingsModal
      v-if="showSettings"
      @close="showSettings = false"
      @update-settings="updateSettings"
    />

    <ParticipantMenu
      v-if="participantMenuData"
      :participant="participantMenuData.participant"
      :position="participantMenuData.position"
      @close="participantMenuData = null"
      @pin="pinParticipant"
      @mute="muteParticipant"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { useRouter } from 'vue-router'
  import VideoGrid from '@/components/conference/VideoGrid.vue'
  import ConferenceControls from '@/components/conference/ConferenceControls.vue'
  import ParticipantsList from '@/components/conference/ParticipantsList.vue'
  import ChatPanel from '@/components/conference/ChatPanel.vue'
  import SettingsModal from '@/components/conference/SettingsModal.vue'
  import ParticipantMenu from '@/components/conference/ParticipantMenu.vue'
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

  interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    message: string
    timestamp: Date
  }

  const router = useRouter()

  // Props
  const props = defineProps<{
    roomId: string
  }>()

  // State
  const roomName = ref('Conference Room')
  const currentUserId = ref('user-1')
  const isMuted = ref(false)
  const isVideoOff = ref(false)
  const isPresenting = ref(false)
  const isRecording = ref(false)
  const currentLayout = ref<'grid' | 'speaker' | 'presentation'>('grid')
  const pinnedParticipant = ref<string | null>(null)

  const showSidebar = ref(false)
  const activeTab = ref<'participants' | 'chat'>('participants')
  const showSettings = ref(false)
  const participantMenuData = ref<{
    participant: Participant
    position: { x: number; y: number }
  } | null>(null)

  const unreadMessages = ref(0)

  // Mock data
  const participants = ref<Participant[]>([
    {
      id: 'user-1',
      name: 'You',
      isAudioMuted: false,
      isVideoOff: false,
      isPresenting: false,
      isHost: true,
    },
    {
      id: 'user-2',
      name: 'Alice Johnson',
      isAudioMuted: false,
      isVideoOff: false,
      isPresenting: false,
      isHost: false,
    },
    {
      id: 'user-3',
      name: 'Bob Smith',
      isAudioMuted: true,
      isVideoOff: false,
      isPresenting: false,
      isHost: false,
    },
    {
      id: 'user-4',
      name: 'Carol Davis',
      isAudioMuted: false,
      isVideoOff: true,
      isPresenting: false,
      isHost: false,
    },
    {
      id: 'user-5',
      name: 'David Wilson',
      isAudioMuted: false,
      isVideoOff: false,
      isPresenting: true,
      isHost: false,
    },
  ])

  const chatMessages = ref<ChatMessage[]>([
    {
      id: '1',
      senderId: 'user-2',
      senderName: 'Alice Johnson',
      message: 'Hello everyone!',
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: '2',
      senderId: 'user-1',
      senderName: 'You',
      message: 'Hi Alice! Welcome to the meeting.',
      timestamp: new Date(Date.now() - 240000),
    },
    {
      id: '3',
      senderId: 'user-3',
      senderName: 'Bob Smith',
      message: 'Can everyone see my screen share?',
      timestamp: new Date(Date.now() - 120000),
    },
  ])

  // Computed
  const showParticipants = computed(() => activeTab.value === 'participants' && showSidebar.value)
  const showChat = computed(() => activeTab.value === 'chat' && showSidebar.value)

  // Methods
  const toggleParticipants = () => {
    if (activeTab.value === 'participants' && showSidebar.value) {
      showSidebar.value = false
    } else {
      activeTab.value = 'participants'
      showSidebar.value = true
    }
  }

  const toggleChat = () => {
    if (activeTab.value === 'chat' && showSidebar.value) {
      showSidebar.value = false
    } else {
      activeTab.value = 'chat'
      showSidebar.value = true
      unreadMessages.value = 0
    }
  }

  const openSettings = () => {
    showSettings.value = true
  }

  const leaveRoom = () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
      router.push('/join')
    }
  }

  const toggleAudio = () => {
    isMuted.value = !isMuted.value
    // TODO: Implement actual audio toggle
  }

  const toggleVideo = () => {
    isVideoOff.value = !isVideoOff.value
    // TODO: Implement actual video toggle
  }

  const toggleScreenShare = () => {
    isPresenting.value = !isPresenting.value
    // TODO: Implement actual screen share toggle
  }

  const toggleRecording = () => {
    isRecording.value = !isRecording.value
    // TODO: Implement actual recording toggle
  }

  const changeLayout = (layout: 'grid' | 'speaker' | 'presentation') => {
    currentLayout.value = layout
  }

  const pinParticipant = (participantId: string) => {
    pinnedParticipant.value = pinnedParticipant.value === participantId ? null : participantId
    participantMenuData.value = null
  }

  const toggleParticipantMenu = (data: {
    participant: Participant
    position: { x: number; y: number }
  }) => {
    participantMenuData.value = data
  }

  const muteParticipant = (participantId: string) => {
    const participant = participants.value.find((p) => p.id === participantId)
    if (participant) {
      participant.isAudioMuted = !participant.isAudioMuted
    }
    participantMenuData.value = null
  }

  const removeParticipant = (participantId: string) => {
    participants.value = participants.value.filter((p) => p.id !== participantId)
  }

  const sendMessage = (message: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUserId.value,
      senderName: 'You',
      message,
      timestamp: new Date(),
    }
    chatMessages.value.push(newMessage)
  }

  const updateSettings = (settings: any) => {
    // TODO: Implement settings update
    console.log('Settings updated:', settings)
    showSettings.value = false
  }

  // Lifecycle
  onMounted(() => {
    // TODO: Join conference room
    console.log('Joining room:', props.roomId)
  })

  onUnmounted(() => {
    // TODO: Cleanup connections
  })
</script>

<style scoped>
  .conference-room {
    height: 100vh;
    background: #1a1a1a;
    color: white;
    display: flex;
    flex-direction: column;
  }

  .conference-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: #2d2d2d;
    border-bottom: 1px solid #404040;
  }

  .room-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .room-title {
    font-size: 18px;
    font-weight: 500;
    margin: 0;
  }

  .participant-count {
    font-size: 14px;
    color: #b3b3b3;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    position: relative;
  }

  .btn-secondary {
    background: #404040;
    color: white;
  }

  .btn-secondary:hover {
    background: #505050;
  }

  .btn-danger {
    background: #ea4335;
    color: white;
  }

  .btn-danger:hover {
    background: #d33b2c;
  }

  .badge {
    background: #ea4335;
    color: white;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 12px;
    min-width: 16px;
    text-align: center;
  }

  .conference-content {
    flex: 1;
    display: flex;
    height: calc(100vh - 73px);
  }

  .conference-content.sidebar-open .video-area {
    width: calc(100% - 350px);
  }

  .video-area {
    flex: 1;
    position: relative;
    width: 100%;
    transition: width 0.3s ease;
  }

  .sidebar {
    width: 350px;
    background: #2d2d2d;
    border-left: 1px solid #404040;
    display: flex;
    flex-direction: column;
  }

  .sidebar-tabs {
    display: flex;
    border-bottom: 1px solid #404040;
  }

  .tab-btn {
    flex: 1;
    padding: 16px;
    background: none;
    border: none;
    color: #b3b3b3;
    cursor: pointer;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
  }

  .tab-btn.active {
    color: white;
    background: #404040;
  }

  .tab-btn:hover {
    color: white;
  }

  @media (max-width: 768px) {
    .conference-header {
      padding: 12px 16px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .header-actions {
      gap: 8px;
    }

    .btn {
      padding: 6px 12px;
      font-size: 12px;
    }

    .sidebar {
      width: 100%;
      position: absolute;
      top: 0;
      right: 0;
      height: 100%;
      z-index: 100;
    }

    .conference-content.sidebar-open .video-area {
      width: 100%;
    }
  }
</style>

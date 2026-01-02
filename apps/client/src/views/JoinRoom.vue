<template>
  <div class="join-room">
    <div class="join-container">
      <div class="join-content">
        <!-- Logo/Brand -->
        <div class="brand">
          <div class="brand-icon">
            <SimpleIcon name="video" :size="32" />
          </div>
          <h1>{{ appName }}</h1>
          <p class="tagline">High-quality video conferencing for everyone</p>
        </div>

        <!-- Main Join Form -->
        <div class="join-form">
          <div class="form-section">
            <h2>Join or start a meeting</h2>

            <!-- Room ID Input -->
            <div class="input-group">
              <label for="roomId">Meeting ID</label>
              <input
                id="roomId"
                v-model="roomId"
                type="text"
                placeholder="Enter meeting ID"
                class="text-input"
                @keydown.enter="joinRoom"
              />
            </div>

            <!-- Display Name Input -->
            <div class="input-group">
              <label for="displayName">Your name</label>
              <input
                id="displayName"
                v-model="displayName"
                type="text"
                placeholder="Enter your name"
                class="text-input"
                @keydown.enter="joinRoom"
              />
            </div>

            <!-- Preview Section -->
            <div class="preview-section">
              <div class="video-preview">
                <video
                  ref="previewVideo"
                  autoplay
                  muted
                  playsinline
                  class="preview-video"
                  :class="{ 'video-off': !videoEnabled }"
                />
                <div v-if="!videoEnabled" class="video-off-placeholder">
                  <div class="avatar">
                    {{ getInitials(displayName || 'User') }}
                  </div>
                </div>

                <!-- Preview Controls -->
                <div class="preview-controls">
                  <button
                    class="preview-control-btn"
                    :class="{ muted: !audioEnabled }"
                    :title="audioEnabled ? 'Mute microphone' : 'Unmute microphone'"
                    @click="toggleAudio"
                  >
                    <SimpleIcon :name="audioEnabled ? 'mic' : 'mic-off'" />
                  </button>

                  <button
                    class="preview-control-btn"
                    :class="{ 'video-off': !videoEnabled }"
                    :title="videoEnabled ? 'Turn off camera' : 'Turn on camera'"
                    @click="toggleVideo"
                  >
                    <SimpleIcon :name="videoEnabled ? 'video' : 'video-off'" />
                  </button>

                  <button
                    class="preview-control-btn"
                    title="Device settings"
                    @click="openDeviceSettings"
                  >
                    <SimpleIcon name="settings" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
              <button class="btn btn-primary" :disabled="!canJoin" @click="joinRoom">
                Join meeting
              </button>

              <button class="btn btn-secondary" @click="startNewMeeting">Start new meeting</button>
            </div>

            <!-- Additional Options -->
            <div class="additional-options">
              <details class="options-section">
                <summary>Advanced options</summary>
                <div class="options-content">
                  <label class="checkbox-option">
                    <input v-model="joinWithoutAudio" type="checkbox" />
                    <span>Join without audio</span>
                  </label>

                  <label class="checkbox-option">
                    <input v-model="joinWithoutVideo" type="checkbox" />
                    <span>Join without video</span>
                  </label>

                  <label class="checkbox-option">
                    <input v-model="useLowQuality" type="checkbox" />
                    <span>Use low quality for slow connections</span>
                  </label>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Recent Meetings -->
        <div v-if="recentMeetings.length > 0" class="recent-meetings">
          <h3>Recent meetings</h3>
          <div class="recent-list">
            <button
              v-for="meeting in recentMeetings"
              :key="meeting.id"
              class="recent-item"
              @click="rejoinMeeting(meeting)"
            >
              <div class="recent-info">
                <div class="recent-title">{{ meeting.title }}</div>
                <div class="recent-details">
                  {{ meeting.id }} • {{ formatRecentDate(meeting.lastJoined) }}
                </div>
              </div>
              <SimpleIcon name="chevron-right" :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Side Panel -->
      <div class="side-panel">
        <div class="feature-highlights">
          <h3>What you can do</h3>
          <div class="features">
            <div class="feature">
              <SimpleIcon name="video" class="feature-icon" />
              <div>
                <div class="feature-title">HD video calls</div>
                <div class="feature-description">Crystal clear video quality</div>
              </div>
            </div>

            <div class="feature">
              <SimpleIcon name="screen-share" class="feature-icon" />
              <div>
                <div class="feature-title">Screen sharing</div>
                <div class="feature-description">Share your screen with everyone</div>
              </div>
            </div>

            <div class="feature">
              <SimpleIcon name="chat" class="feature-icon" />
              <div>
                <div class="feature-title">Real-time chat</div>
                <div class="feature-description">Send messages during the call</div>
              </div>
            </div>

            <div class="feature">
              <SimpleIcon name="record" class="feature-icon" />
              <div>
                <div class="feature-title">Meeting recording</div>
                <div class="feature-description">Record meetings for later</div>
              </div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <h4>Need help?</h4>
          <a href="#" class="help-link">
            <SimpleIcon name="info" :size="16" />
            <span>How to join a meeting</span>
          </a>
          <a href="#" class="help-link">
            <SimpleIcon name="settings" :size="16" />
            <span>Check your device setup</span>
          </a>
          <a href="#" class="help-link">
            <SimpleIcon name="keyboard" :size="16" />
            <span>Keyboard shortcuts</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Device Settings Modal -->
    <DeviceSettingsModal
      v-if="showDeviceSettings"
      @close="showDeviceSettings = false"
      @update-devices="updateDevices"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { useRouter } from 'vue-router'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'
  import DeviceSettingsModal from '@/components/conference/DeviceSettingsModal.vue'

  interface RecentMeeting {
    id: string
    title: string
    lastJoined: Date
  }

  const router = useRouter()

  // State
  const roomId = ref('')
  const displayName = ref('')
  const audioEnabled = ref(true)
  const videoEnabled = ref(true)
  const joinWithoutAudio = ref(false)
  const joinWithoutVideo = ref(false)
  const useLowQuality = ref(false)
  const showDeviceSettings = ref(false)
  const previewVideo = ref<HTMLVideoElement>()
  const previewStream = ref<MediaStream | null>(null)

  const appName = ref('Conference App')

  // Mock data
  const recentMeetings = ref<RecentMeeting[]>([
    {
      id: 'abc-def-ghi',
      title: 'Team Weekly Standup',
      lastJoined: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    },
    {
      id: 'jkl-mno-pqr',
      title: 'Client Presentation',
      lastJoined: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      id: 'stu-vwx-yz1',
      title: 'Product Planning',
      lastJoined: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    },
  ])

  onMounted(async () => {
    // Load saved display name
    const savedName = localStorage.getItem('conferenceDisplayName')
    if (savedName) {
      displayName.value = savedName
    }

    // Auto-generate room ID if in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const urlRoomId = urlParams.get('room')
    if (urlRoomId) {
      roomId.value = urlRoomId
    }

    // Start camera preview
    await startPreview()
  })

  onUnmounted(() => {
    stopPreview()
  })

  // Computed
  const canJoin = computed(() => {
    return roomId.value.trim().length > 0 && displayName.value.trim().length > 0
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

  const formatRecentDate = (date: Date) => {
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled.value,
        audio: audioEnabled.value,
      })

      previewStream.value = stream

      if (previewVideo.value && videoEnabled.value) {
        previewVideo.value.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing media devices:', error)
      // Handle permission denied or device not available
    }
  }

  const stopPreview = () => {
    if (previewStream.value) {
      previewStream.value.getTracks().forEach((track) => track.stop())
      previewStream.value = null
    }
  }

  const toggleAudio = async () => {
    audioEnabled.value = !audioEnabled.value

    if (previewStream.value) {
      const audioTrack = previewStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = audioEnabled.value
      }
    }
  }

  const toggleVideo = async () => {
    videoEnabled.value = !videoEnabled.value

    if (previewStream.value) {
      const videoTrack = previewStream.value.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = videoEnabled.value
      }
    }

    // Update preview video element
    if (previewVideo.value) {
      if (videoEnabled.value) {
        previewVideo.value.srcObject = previewStream.value
      } else {
        previewVideo.value.srcObject = null
      }
    }
  }

  const openDeviceSettings = () => {
    showDeviceSettings.value = true
  }

  const updateDevices = (devices: any) => {
    console.log('Update devices:', devices)
    // TODO: Apply new device selections
    showDeviceSettings.value = false
  }

  const joinRoom = async () => {
    if (!canJoin.value) return

    // Save display name
    localStorage.setItem('conferenceDisplayName', displayName.value.trim())

    // Apply join options
    if (joinWithoutAudio.value) {
      audioEnabled.value = false
    }
    if (joinWithoutVideo.value) {
      videoEnabled.value = false
    }

    // Navigate to conference room
    router.push({
      name: 'ConferenceRoom',
      params: { roomId: roomId.value.trim() },
      query: {
        name: displayName.value.trim(),
        audio: audioEnabled.value.toString(),
        video: videoEnabled.value.toString(),
        quality: useLowQuality.value ? 'low' : 'high',
      },
    })
  }

  const startNewMeeting = () => {
    // Generate random room ID
    const newRoomId = Math.random().toString(36).substring(2, 15)
    roomId.value = newRoomId
    joinRoom()
  }

  const rejoinMeeting = (meeting: RecentMeeting) => {
    roomId.value = meeting.id
    if (canJoin.value) {
      joinRoom()
    }
  }
</script>

<style scoped>
  .join-room {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .join-container {
    max-width: 1200px;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 40px;
    align-items: start;
  }

  .join-content {
    background: white;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  }

  .brand {
    text-align: center;
    margin-bottom: 40px;
  }

  .brand-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin: 0 auto 16px;
  }

  .brand h1 {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .tagline {
    color: #666;
    font-size: 16px;
    margin: 0;
  }

  .join-form {
    margin-bottom: 40px;
  }

  .form-section h2 {
    margin: 0 0 24px;
    font-size: 24px;
    font-weight: 500;
    color: #1a1a1a;
  }

  .input-group {
    margin-bottom: 20px;
  }

  .input-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
  }

  .text-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.2s;
  }

  .text-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .preview-section {
    margin: 24px 0;
  }

  .video-preview {
    position: relative;
    width: 100%;
    height: 200px;
    background: #1a1a1a;
    border-radius: 12px;
    overflow: hidden;
  }

  .preview-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-video.video-off {
    display: none;
  }

  .video-off-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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

  .preview-controls {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }

  .preview-control-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
  }

  .preview-control-btn:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  .preview-control-btn.muted,
  .preview-control-btn.video-off {
    background: #ea4335;
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #667eea;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5a67d8;
  }

  .btn-secondary {
    background: #f7f7f7;
    color: #333;
    border: 1px solid #e0e0e0;
  }

  .btn-secondary:hover {
    background: #f0f0f0;
  }

  .additional-options {
    border-top: 1px solid #e0e0e0;
    padding-top: 20px;
  }

  .options-section summary {
    cursor: pointer;
    font-weight: 500;
    color: #667eea;
    margin-bottom: 12px;
  }

  .options-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-option input[type='checkbox'] {
    width: 16px;
    height: 16px;
  }

  .recent-meetings {
    border-top: 1px solid #e0e0e0;
    padding-top: 24px;
  }

  .recent-meetings h3 {
    margin: 0 0 16px;
    font-size: 18px;
    font-weight: 500;
    color: #333;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    background: #f7f7f7;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }

  .recent-item:hover {
    background: #f0f0f0;
    border-color: #667eea;
  }

  .recent-title {
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .recent-details {
    font-size: 12px;
    color: #666;
  }

  .side-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }

  .feature-highlights h3 {
    margin: 0 0 24px;
    font-size: 20px;
    font-weight: 500;
    color: #333;
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 32px;
  }

  .feature {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .feature-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
  }

  .feature-title {
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .feature-description {
    font-size: 14px;
    color: #666;
    line-height: 1.4;
  }

  .help-section {
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    padding-top: 24px;
  }

  .help-section h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  .help-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: #667eea;
    text-decoration: none;
    font-size: 14px;
    transition: color 0.2s;
  }

  .help-link:hover {
    color: #5a67d8;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .join-container {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .join-content {
      padding: 24px;
    }

    .side-panel {
      order: -1;
      padding: 20px;
    }

    .action-buttons {
      flex-direction: column;
    }

    .brand h1 {
      font-size: 24px;
    }

    .form-section h2 {
      font-size: 20px;
    }
  }
</style>

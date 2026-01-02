<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>Device Settings</h2>
        <button class="close-btn" @click="$emit('close')">
          <SimpleIcon name="x" />
        </button>
      </div>

      <div class="modal-content">
        <!-- Camera Settings -->
        <div class="device-section">
          <h3>
            <SimpleIcon name="video" />
            Camera
          </h3>
          <select v-model="selectedCamera" class="device-select">
            <option value="">No camera</option>
            <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
              {{ camera.label || `Camera ${camera.deviceId.slice(0, 8)}` }}
            </option>
          </select>

          <div class="device-preview">
            <video ref="cameraPreview" autoplay muted playsinline class="preview-video" />
          </div>
        </div>

        <!-- Microphone Settings -->
        <div class="device-section">
          <h3>
            <SimpleIcon name="mic" />
            Microphone
          </h3>
          <select v-model="selectedMicrophone" class="device-select">
            <option value="">No microphone</option>
            <option v-for="mic in microphones" :key="mic.deviceId" :value="mic.deviceId">
              {{ mic.label || `Microphone ${mic.deviceId.slice(0, 8)}` }}
            </option>
          </select>

          <div class="audio-level">
            <div class="level-label">Audio level:</div>
            <div class="level-bar">
              <div class="level-fill" :style="{ width: audioLevel + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Speaker Settings -->
        <div class="device-section">
          <h3>
            <SimpleIcon name="volume" />
            Speaker
          </h3>
          <select v-model="selectedSpeaker" class="device-select">
            <option value="">Default speaker</option>
            <option v-for="speaker in speakers" :key="speaker.deviceId" :value="speaker.deviceId">
              {{ speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}` }}
            </option>
          </select>

          <button class="test-speaker-btn" @click="testSpeaker">
            <SimpleIcon name="volume" />
            Test speaker
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="saveSettings">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  const emit = defineEmits<{
    close: []
    'update-devices': [devices: any]
  }>()

  const selectedCamera = ref('')
  const selectedMicrophone = ref('')
  const selectedSpeaker = ref('')
  const audioLevel = ref(0)

  const cameras = ref<MediaDeviceInfo[]>([])
  const microphones = ref<MediaDeviceInfo[]>([])
  const speakers = ref<MediaDeviceInfo[]>([])

  const cameraPreview = ref<HTMLVideoElement>()
  let currentStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null

  onMounted(async () => {
    await loadDevices()
    startCameraPreview()
  })

  onUnmounted(() => {
    cleanup()
  })

  watch([selectedCamera, selectedMicrophone], () => {
    startCameraPreview()
  })

  const loadDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

      const devices = await navigator.mediaDevices.enumerateDevices()
      cameras.value = devices.filter((device) => device.kind === 'videoinput')
      microphones.value = devices.filter((device) => device.kind === 'audioinput')
      speakers.value = devices.filter((device) => device.kind === 'audiooutput')

      // Set default selections
      if (cameras.value.length > 0 && !selectedCamera.value) {
        selectedCamera.value = cameras.value[0].deviceId
      }
      if (microphones.value.length > 0 && !selectedMicrophone.value) {
        selectedMicrophone.value = microphones.value[0].deviceId
      }
      if (speakers.value.length > 0 && !selectedSpeaker.value) {
        selectedSpeaker.value = speakers.value[0].deviceId
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const startCameraPreview = async () => {
    cleanup()

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera.value ? { deviceId: selectedCamera.value } : true,
        audio: selectedMicrophone.value ? { deviceId: selectedMicrophone.value } : true,
      }

      currentStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Set up video preview
      if (cameraPreview.value) {
        cameraPreview.value.srcObject = currentStream
      }

      // Set up audio level monitoring
      if (currentStream.getAudioTracks().length > 0) {
        setupAudioLevelMonitoring(currentStream)
      }
    } catch (error) {
      console.error('Error starting camera preview:', error)
    }
  }

  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateAudioLevel = () => {
        if (!analyser) return

        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        audioLevel.value = (sum / bufferLength / 255) * 100

        requestAnimationFrame(updateAudioLevel)
      }

      updateAudioLevel()
    } catch (error) {
      console.error('Error setting up audio monitoring:', error)
    }
  }

  const testSpeaker = () => {
    // Play a test sound
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCzuQ1vTCdjkNGGGz7O1dEQxKp+TwuWoiBzaS2unc'
    )
    audio.volume = 0.5

    if (selectedSpeaker.value && 'setSinkId' in audio) {
      ;(audio as any)
        .setSinkId(selectedSpeaker.value)
        .then(() => audio.play())
        .catch((error: any) => console.error('Error setting speaker:', error))
    } else {
      audio.play()
    }
  }

  const saveSettings = () => {
    emit('update-devices', {
      camera: selectedCamera.value,
      microphone: selectedMicrophone.value,
      speaker: selectedSpeaker.value,
    })
  }

  const cleanup = () => {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop())
      currentStream = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    analyser = null
  }
</script>

<style scoped>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: #666;
  }

  .close-btn:hover {
    background: #f1f3f4;
  }

  .modal-content {
    padding: 20px;
  }

  .device-section {
    margin-bottom: 32px;
  }

  .device-section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 500;
  }

  .device-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .device-preview {
    width: 100%;
    height: 200px;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
  }

  .preview-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .audio-level {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .level-label {
    font-size: 14px;
    color: #666;
    white-space: nowrap;
  }

  .level-bar {
    flex: 1;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .level-fill {
    height: 100%;
    background: linear-gradient(90deg, #34a853 0%, #fbbc04 70%, #ea4335 100%);
    transition: width 0.1s ease;
  }

  .test-speaker-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #f1f3f4;
    border: 1px solid #dadce0;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .test-speaker-btn:hover {
    background: #e8eaed;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid #e0e0e0;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .btn-primary {
    background: #1a73e8;
    color: white;
  }

  .btn-primary:hover {
    background: #1557b0;
  }

  .btn-secondary {
    background: #f1f3f4;
    color: #333;
    border: 1px solid #dadce0;
  }

  .btn-secondary:hover {
    background: #e8eaed;
  }
</style>

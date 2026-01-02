<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="$emit('close')">
          <SimpleIcon name="x" />
        </button>
      </div>

      <div class="modal-content">
        <div class="settings-section">
          <h3>Camera</h3>
          <select v-model="selectedCamera" class="device-select">
            <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
              {{ camera.label || `Camera ${camera.deviceId.slice(0, 8)}` }}
            </option>
          </select>
        </div>

        <div class="settings-section">
          <h3>Microphone</h3>
          <select v-model="selectedMicrophone" class="device-select">
            <option v-for="mic in microphones" :key="mic.deviceId" :value="mic.deviceId">
              {{ mic.label || `Microphone ${mic.deviceId.slice(0, 8)}` }}
            </option>
          </select>
        </div>

        <div class="settings-section">
          <h3>Speaker</h3>
          <select v-model="selectedSpeaker" class="device-select">
            <option v-for="speaker in speakers" :key="speaker.deviceId" :value="speaker.deviceId">
              {{ speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}` }}
            </option>
          </select>
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
  import { ref, onMounted } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  const emit = defineEmits<{
    close: []
    'update-settings': [settings: any]
  }>()

  const selectedCamera = ref('')
  const selectedMicrophone = ref('')
  const selectedSpeaker = ref('')

  const cameras = ref<MediaDeviceInfo[]>([])
  const microphones = ref<MediaDeviceInfo[]>([])
  const speakers = ref<MediaDeviceInfo[]>([])

  onMounted(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      cameras.value = devices.filter((device) => device.kind === 'videoinput')
      microphones.value = devices.filter((device) => device.kind === 'audioinput')
      speakers.value = devices.filter((device) => device.kind === 'audiooutput')

      // Set default selections
      if (cameras.value.length > 0) selectedCamera.value = cameras.value[0].deviceId
      if (microphones.value.length > 0) selectedMicrophone.value = microphones.value[0].deviceId
      if (speakers.value.length > 0) selectedSpeaker.value = speakers.value[0].deviceId
    } catch (error) {
      console.error('Error enumerating devices:', error)
    }
  })

  const saveSettings = () => {
    emit('update-settings', {
      camera: selectedCamera.value,
      microphone: selectedMicrophone.value,
      speaker: selectedSpeaker.value,
    })
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
    max-width: 500px;
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
  }

  .modal-content {
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 20px;
  }

  .settings-section h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .device-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
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
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-primary {
    background: #1a73e8;
    color: white;
  }

  .btn-secondary {
    background: #f1f3f4;
    color: #333;
  }
</style>

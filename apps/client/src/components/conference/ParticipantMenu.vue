<template>
  <div
    class="participant-menu"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @click.stop
  >
    <button class="menu-item" @click="$emit('pin', participant.id)">
      <SimpleIcon name="pin" />
      <span>{{ isPinned ? 'Unpin' : 'Pin' }} participant</span>
    </button>

    <button v-if="canMute" class="menu-item" @click="$emit('mute', participant.id)">
      <SimpleIcon :name="participant.isAudioMuted ? 'mic' : 'mic-off'" />
      <span>{{ participant.isAudioMuted ? 'Unmute' : 'Mute' }}</span>
    </button>

    <button class="menu-item" @click="sendPrivateMessage">
      <SimpleIcon name="message-circle" />
      <span>Send private message</span>
    </button>

    <button v-if="isHost" class="menu-item" @click="spotlight">
      <SimpleIcon name="spotlight" />
      <span>Spotlight for everyone</span>
    </button>

    <div v-if="isHost" class="menu-divider"></div>

    <button v-if="isHost && !participant.isHost" class="menu-item" @click="makeHost">
      <SimpleIcon name="crown" />
      <span>Make host</span>
    </button>

    <button v-if="isHost && !isCurrentUser" class="menu-item danger" @click="remove">
      <SimpleIcon name="user-x" />
      <span>Remove from meeting</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  interface Participant {
    id: string
    name: string
    isAudioMuted: boolean
    isVideoOff: boolean
    isPresenting: boolean
    isHost: boolean
  }

  const props = defineProps<{
    participant: Participant
    position: { x: number; y: number }
  }>()

  const emit = defineEmits<{
    close: []
    pin: [id: string]
    mute: [id: string]
  }>()

  // Mock values - these should come from parent or store
  const isHost = true
  const currentUserId = 'user-1'
  const isPinned = false

  const isCurrentUser = computed(() => props.participant.id === currentUserId)
  const canMute = computed(() => isHost || isCurrentUser.value)

  const sendPrivateMessage = () => {
    console.log('Send private message to:', props.participant.name)
    emit('close')
  }

  const spotlight = () => {
    console.log('Spotlight participant:', props.participant.name)
    emit('close')
  }

  const makeHost = () => {
    if (confirm(`Make ${props.participant.name} the host?`)) {
      console.log('Make host:', props.participant.name)
    }
    emit('close')
  }

  const remove = () => {
    if (confirm(`Remove ${props.participant.name} from the meeting?`)) {
      console.log('Remove participant:', props.participant.name)
    }
    emit('close')
  }
</script>

<style scoped>
  .participant-menu {
    position: fixed;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 200px;
    z-index: 1000;
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
</style>

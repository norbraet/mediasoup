<script setup lang="ts">
  import { ref } from 'vue'
  import type { UseChat } from '../types/types'

  const props = defineProps<{
    chat: UseChat
    roomName: string
  }>()

  const input = ref('')

  const send = () => {
    props.chat.sendMessage(props.roomName, input.value)
    input.value = ''
  }
</script>

<template>
  <div class="chat-panel">
    <div class="messages">
      <div v-for="(msg, index) in props.chat.messages.value" :key="index" class="message">
        <strong>{{ msg.userName }}:</strong>
        <span>{{ msg.message }}</span>
      </div>
    </div>

    <form class="chat-input" @submit.prevent="send">
      <input v-model="input" placeholder="Type a message…" />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

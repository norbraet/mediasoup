<script setup lang="ts">
  import { ref, watch, nextTick } from 'vue'
  import type { UseChat } from '../types/types'
  import { useTypedI18n } from '../composables/useI18n'

  const props = defineProps<{
    chat: UseChat
    roomName: string
  }>()

  const input = ref('')
  const messagesEl = ref<HTMLDivElement | null>(null)
  const { t } = useTypedI18n()

  const send = () => {
    if (!input.value.trim()) return
    props.chat.sendMessage(props.roomName, input.value)
    input.value = ''
  }

  watch(
    () => props.chat.messages.value.length,
    async () => {
      await nextTick()
      if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight
      }
    }
  )
</script>

<template>
  <aside class="chat-panel">
    <!-- Messages -->
    <div ref="messagesEl" class="messages">
      <div v-for="(msg, index) in chat.messages.value" :key="index" class="message">
        <span class="author">{{ msg.userName }}</span>
        <span class="text">{{ msg.message }}</span>
      </div>
    </div>

    <!-- Input -->
    <form class="chat-input" @submit.prevent="send">
      <input v-model="input" :placeholder="t('chat.placeholder')" autocomplete="off" />
      <button type="submit">{{ t('chat.send') }}</button>
    </form>
  </aside>
</template>

<style scoped>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  /* Scrollable message list */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Message bubble */
  .message {
    display: flex;
    gap: 0.5rem;
    line-height: 1.4;
  }

  .author {
    font-weight: 600;
  }

  /* Input pinned to bottom */
  .chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .chat-input input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #3d3d3d;
  }

  .chat-input button {
    padding: 0.5rem 0.75rem;
    border: 1px solid #3d3d3d;
  }
</style>

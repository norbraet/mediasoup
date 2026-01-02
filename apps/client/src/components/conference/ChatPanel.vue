<template>
  <div class="chat-panel">
    <div class="chat-header">
      <h3>Meeting chat</h3>
      <div class="chat-options">
        <button
          class="option-btn"
          :class="{ active: showToEveryone }"
          title="Send to everyone"
          @click="showToEveryone = true"
        >
          Everyone
        </button>
        <button
          class="option-btn"
          :class="{ active: !showToEveryone }"
          title="Send privately"
          @click="showToEveryone = false"
        >
          Private
        </button>

        <button class="icon-btn" @click="openChatSettings">
          <SimpleIcon name="more-horizontal" />
        </button>
      </div>
    </div>

    <div ref="messagesContainer" class="messages-container">
      <!-- Date separator -->
      <div class="date-separator">
        <span>{{ formatDate(new Date()) }}</span>
      </div>

      <!-- Messages -->
      <div
        v-for="message in filteredMessages"
        :key="message.id"
        class="message"
        :class="{
          'is-own': message.senderId === currentUserId,
          'is-private': message.isPrivate,
          'is-system': message.isSystem,
        }"
      >
        <!-- System messages -->
        <div v-if="message.isSystem" class="system-message">
          <SimpleIcon name="info" />
          <span>{{ message.message }}</span>
        </div>

        <!-- Regular messages -->
        <div v-else class="user-message">
          <div class="message-header">
            <div class="sender-info">
              <span class="sender-name">{{ getSenderDisplayName(message) }}</span>
              <span v-if="message.isPrivate" class="private-label"> (Private) </span>
            </div>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>

          <div class="message-content">
            <div class="message-text" v-html="formatMessageText(message.message)"></div>

            <!-- Message reactions -->
            <div v-if="message.reactions && message.reactions.length > 0" class="message-reactions">
              <button
                v-for="reaction in message.reactions"
                :key="reaction.emoji"
                class="reaction-btn"
                :class="{ 'has-user-reaction': reaction.users.includes(currentUserId) }"
                @click="toggleReaction(message.id, reaction.emoji)"
              >
                <span>{{ reaction.emoji }}</span>
                <span class="reaction-count">{{ reaction.count }}</span>
              </button>
            </div>
          </div>

          <!-- Message actions -->
          <div class="message-actions">
            <button class="action-btn" title="Add reaction" @click="addReaction(message.id, '👍')">
              <SimpleIcon name="smile" />
            </button>

            <button
              v-if="message.senderId !== currentUserId"
              class="action-btn"
              title="Reply privately"
              @click="replyToMessage(message)"
            >
              <SimpleIcon name="reply" />
            </button>

            <button
              v-if="message.senderId === currentUserId || isHost"
              class="action-btn"
              title="Delete message"
              @click="deleteMessage(message.id)"
            >
              <SimpleIcon name="trash" />
            </button>
          </div>
        </div>
      </div>

      <!-- Typing indicators -->
      <div v-if="typingUsers.length > 0" class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="typing-text">
          {{ getTypingText() }}
        </span>
      </div>
    </div>

    <!-- Message input -->
    <div class="message-input-container">
      <!-- Private message recipient -->
      <div v-if="replyingTo" class="reply-header">
        <span class="reply-text">Replying to {{ replyingTo.senderName }} privately</span>
        <button class="clear-reply" @click="clearReply">
          <SimpleIcon name="x" />
        </button>
      </div>

      <div class="input-wrapper">
        <div class="message-input">
          <textarea
            ref="messageInput"
            v-model="currentMessage"
            placeholder="Type a message..."
            rows="1"
            maxlength="500"
            @keydown="handleKeyDown"
            @input="handleTyping"
          ></textarea>

          <div class="input-actions">
            <button class="input-btn" title="Add emoji" @click="openEmojiPicker">
              <SimpleIcon name="smile" />
            </button>

            <button class="input-btn" title="Attach file" @click="attachFile">
              <SimpleIcon name="paperclip" />
            </button>

            <button
              class="send-btn"
              :disabled="!canSendMessage"
              title="Send message"
              @click="sendMessage"
            >
              <SimpleIcon name="send" />
            </button>
          </div>
        </div>

        <div class="message-options">
          <label class="option-checkbox">
            <input v-model="sendToEveryone" type="checkbox" :disabled="!!replyingTo" />
            <span>Send to everyone</span>
          </label>

          <span class="character-count" :class="{ 'near-limit': currentMessage.length > 450 }">
            {{ currentMessage.length }}/500
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  interface ChatMessage {
    id: string
    senderId: string
    senderName: string
    message: string
    timestamp: Date
    isPrivate?: boolean
    isSystem?: boolean
    recipientId?: string
    reactions?: Array<{
      emoji: string
      count: number
      users: string[]
    }>
  }

  const props = defineProps<{
    messages: ChatMessage[]
    currentUserId: string
  }>()

  const emit = defineEmits<{
    'send-message': [message: string, isPrivate?: boolean, recipientId?: string]
  }>()

  // State
  const currentMessage = ref('')
  const sendToEveryone = ref(true)
  const showToEveryone = ref(true)
  const replyingTo = ref<ChatMessage | null>(null)
  const typingUsers = ref<Array<{ id: string; name: string }>>([])
  const isHost = ref(true) // Mock - should come from props
  const messagesContainer = ref<HTMLElement>()
  const messageInput = ref<HTMLTextAreaElement>()

  // Typing timeout
  let typingTimeout: number | null = null

  onMounted(() => {
    scrollToBottom()
  })

  onUnmounted(() => {
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
  })

  // Computed
  const filteredMessages = computed(() => {
    if (showToEveryone.value) {
      return props.messages.filter((msg) => !msg.isPrivate)
    }
    return props.messages.filter(
      (msg) =>
        msg.isPrivate &&
        (msg.senderId === props.currentUserId || msg.recipientId === props.currentUserId)
    )
  })

  const canSendMessage = computed(() => {
    return currentMessage.value.trim().length > 0 && currentMessage.value.length <= 500
  })

  // Methods
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getSenderDisplayName = (message: ChatMessage) => {
    return message.senderId === props.currentUserId ? 'You' : message.senderName
  }

  const formatMessageText = (text: string) => {
    // Simple link detection and emoji support
    return text
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/:\)/g, '😊')
      .replace(/:\(/g, '😢')
      .replace(/:D/g, '😄')
      .replace(/;\)/g, '😉')
  }

  const getTypingText = () => {
    if (typingUsers.value.length === 1) {
      return `${typingUsers.value[0]?.name} is typing...`
    } else if (typingUsers.value.length === 2) {
      return `${typingUsers.value[0]?.name} and ${typingUsers.value[1]?.name} are typing...`
    } else if (typingUsers.value.length > 2) {
      return `${typingUsers.value.length} people are typing...`
    }
    return ''
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSendMessage.value) {
        sendMessage()
      }
    }
  }

  const handleTyping = () => {
    // Auto-resize textarea
    const textarea = messageInput.value
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }

    // Mock typing indicator
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }

    if (currentMessage.value.trim()) {
      // Simulate sending typing indicator
      typingTimeout = setTimeout(() => {
        // Stop typing indicator
      }, 3000) as unknown as number
    }
  }

  const sendMessage = () => {
    if (!canSendMessage.value) return

    const isPrivate = replyingTo.value !== null || !sendToEveryone.value
    const recipientId = replyingTo.value?.senderId

    emit('send-message', currentMessage.value.trim(), isPrivate, recipientId)

    currentMessage.value = ''
    clearReply()

    // Reset textarea height
    if (messageInput.value) {
      messageInput.value.style.height = 'auto'
    }

    nextTick(() => {
      scrollToBottom()
    })
  }

  const replyToMessage = (message: ChatMessage) => {
    replyingTo.value = message
    sendToEveryone.value = false
    messageInput.value?.focus()
  }

  const clearReply = () => {
    replyingTo.value = null
    sendToEveryone.value = true
  }

  const addReaction = (messageId: string, emoji: string) => {
    console.log('Add reaction:', messageId, emoji)
    // TODO: Implement reaction adding
  }

  const toggleReaction = (messageId: string, emoji: string) => {
    console.log('Toggle reaction:', messageId, emoji)
    // TODO: Implement reaction toggling
  }

  const deleteMessage = (messageId: string) => {
    if (confirm('Delete this message?')) {
      console.log('Delete message:', messageId)
      // TODO: Implement message deletion
    }
  }

  const scrollToBottom = () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }

  const openEmojiPicker = () => {
    console.log('Open emoji picker')
    // TODO: Implement emoji picker
  }

  const attachFile = () => {
    console.log('Attach file')
    // TODO: Implement file attachment
  }

  const openChatSettings = () => {
    console.log('Open chat settings')
    // TODO: Implement chat settings
  }
</script>

<style scoped>
  .chat-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #2d2d2d;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #404040;
  }

  .chat-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }

  .chat-options {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .option-btn {
    padding: 6px 12px;
    border: 1px solid #404040;
    background: transparent;
    color: #b3b3b3;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .option-btn.active {
    background: #1a73e8;
    border-color: #1a73e8;
    color: white;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #b3b3b3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .date-separator {
    text-align: center;
    margin: 8px 0;
  }

  .date-separator span {
    background: #404040;
    color: #b3b3b3;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
  }

  .message.is-own {
    align-self: flex-end;
  }

  .message.is-system .system-message {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
    color: #b3b3b3;
    font-size: 13px;
    font-style: italic;
  }

  .user-message {
    max-width: 80%;
    background: #404040;
    border-radius: 12px;
    padding: 12px;
    position: relative;
    transition: background-color 0.2s;
  }

  .message.is-own .user-message {
    background: #1a73e8;
    color: white;
  }

  .message.is-private .user-message {
    background: #7c3aed;
    border: 1px solid #a855f7;
  }

  .user-message:hover {
    background: #505050;
  }

  .message.is-own .user-message:hover {
    background: #1557b0;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .sender-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sender-name {
    font-weight: 500;
    color: white;
  }

  .private-label {
    color: #a855f7;
    font-size: 11px;
  }

  .message-time {
    color: #b3b3b3;
    font-size: 11px;
  }

  .message-text {
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .message-text a {
    color: #4fc3f7;
    text-decoration: none;
  }

  .message-text a:hover {
    text-decoration: underline;
  }

  .message-reactions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .reaction-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reaction-btn.has-user-reaction {
    background: rgba(26, 115, 232, 0.3);
    border-color: #1a73e8;
  }

  .reaction-count {
    font-size: 10px;
    color: #b3b3b3;
  }

  .message-actions {
    position: absolute;
    top: -12px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    background: #1a1a1a;
    border-radius: 8px;
    padding: 4px;
    border: 1px solid #404040;
  }

  .user-message:hover .message-actions {
    opacity: 1;
  }

  .action-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: #b3b3b3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #b3b3b3;
    font-size: 13px;
    font-style: italic;
  }

  .typing-dots {
    display: flex;
    gap: 2px;
  }

  .typing-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #b3b3b3;
    animation: typing-pulse 1.5s ease-in-out infinite;
  }

  .typing-dots span:nth-child(1) {
    animation-delay: 0s;
  }

  .typing-dots span:nth-child(2) {
    animation-delay: 0.3s;
  }

  .typing-dots span:nth-child(3) {
    animation-delay: 0.6s;
  }

  .message-input-container {
    border-top: 1px solid #404040;
    background: #2d2d2d;
  }

  .reply-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: rgba(124, 58, 237, 0.1);
    border-bottom: 1px solid #7c3aed;
    font-size: 13px;
    color: #a855f7;
  }

  .clear-reply {
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: #a855f7;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .input-wrapper {
    padding: 16px;
  }

  .message-input {
    display: flex;
    align-items: end;
    gap: 8px;
    background: #404040;
    border-radius: 20px;
    padding: 8px 12px;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .message-input:focus-within {
    border-color: #1a73e8;
  }

  .message-input textarea {
    flex: 1;
    background: none;
    border: none;
    color: white;
    font-size: 14px;
    resize: none;
    outline: none;
    max-height: 120px;
    min-height: 20px;
    font-family: inherit;
  }

  .message-input textarea::placeholder {
    color: #b3b3b3;
  }

  .input-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .input-btn,
  .send-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #b3b3b3;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
  }

  .input-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .send-btn {
    background: #1a73e8;
    color: white;
  }

  .send-btn:hover:not(:disabled) {
    background: #1557b0;
  }

  .send-btn:disabled {
    background: #404040;
    color: #5f6368;
    cursor: not-allowed;
  }

  .message-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    font-size: 12px;
  }

  .option-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: #b3b3b3;
  }

  .option-checkbox input[type='checkbox'] {
    width: 14px;
    height: 14px;
  }

  .character-count {
    color: #b3b3b3;
  }

  .character-count.near-limit {
    color: #fbbc04;
  }

  @keyframes typing-pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  /* Scrollbar styling */
  .messages-container::-webkit-scrollbar {
    width: 4px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .messages-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>

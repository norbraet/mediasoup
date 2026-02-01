import { onUnmounted, ref } from 'vue'
import type { ChatSocketApi, UseChat } from '../types/types'
import type { ChatMessage, SendChatMessageData } from '@mediasoup/types'

export function useChat(chatApi: ChatSocketApi): UseChat {
  const messages = ref<ChatMessage[]>([])

  const handleIncomingMessage = (message: ChatMessage) => {
    messages.value.push(message)
  }

  const setupChatListeners = () => {
    chatApi.onChatMessage(handleIncomingMessage)
  }

  const cleanupChatListeners = () => {
    chatApi.offChatMessage(handleIncomingMessage)
  }

  const sendMessage = (roomId: string, messageText: string) => {
    if (!messageText.trim()) return
    if (!roomId) {
      console.warn('Cannot send message: no room joined')
      return
    }

    const messageData: SendChatMessageData = {
      roomId,
      message: messageText.trim(),
      timestamp: Date.now(),
    }

    chatApi.sendChatMessage(messageData)
  }

  const clearMessages = () => {
    messages.value = []
  }

  const getMessagesFromUser = (userId: string) =>
    messages.value.filter((msg) => msg.userId === userId)

  const getRecentMessages = (count = 50) => messages.value.slice(-count)

  setupChatListeners()

  onUnmounted(() => {
    cleanupChatListeners()
  })

  return {
    messages: messages,

    sendMessage,
    clearMessages,
    getMessagesFromUser,
    getRecentMessages,
    setupChatListeners,
    cleanupChatListeners,
  }
}

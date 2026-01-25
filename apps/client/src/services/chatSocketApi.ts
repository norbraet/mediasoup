// chatSocketApi.ts
import type { Socket } from 'socket.io-client'
import type { ChatMessage, SendChatMessageData, ChatSocketApi } from '../types/types'

export function createChatSocketApi(socket: Socket): ChatSocketApi {
  return {
    sendChatMessage(data: SendChatMessageData) {
      socket.emit('chat-message', data)
    },

    onChatMessage(callback: (message: ChatMessage) => void) {
      socket.on('chat-message', callback)
    },

    offChatMessage(callback?: (message: ChatMessage) => void) {
      if (callback) {
        socket.off('chat-message', callback)
      } else {
        socket.off('chat-message')
      }
    },
  }
}

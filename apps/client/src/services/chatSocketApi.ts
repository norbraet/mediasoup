// chatSocketApi.ts
import type { Socket } from 'socket.io-client'
import type { ChatSocketApi } from '../types/types'
import type { ChatMessage, SendChatMessageData } from '@mediasoup/types'

export function createChatSocketApi(socket: Socket): ChatSocketApi {
  return {
    sendChatMessage(data: SendChatMessageData) {
      // TODO: TYPES chat-message
      socket.emit('chat-message', data)
    },

    onChatMessage(callback: (message: ChatMessage) => void) {
      // TODO: TYPES chat-message
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

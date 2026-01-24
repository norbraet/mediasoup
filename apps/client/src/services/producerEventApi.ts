import type { Socket } from 'socket.io-client'
import type { ProducerSocketApi } from '../types/types'

export function createProducerSocketApi(socket: Socket): ProducerSocketApi {
  return {
    emitAudioMuted(isMuted: boolean) {
      socket.emit('audio-muted', { isAudioMuted: isMuted })
    },
    emitVideoEnabled(isEnabled: boolean) {
      socket.emit('video-toggled', { isVideoEnabled: isEnabled })
    },
  }
}

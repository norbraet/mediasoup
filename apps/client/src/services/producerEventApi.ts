import type { Socket } from 'socket.io-client'
import type { ProducerSocketApi } from '../types/types'

export function createProducerSocketApi(socket: Socket): ProducerSocketApi {
  return {
    emitAudioMuted(isMuted: boolean) {
      // TODO: TYPES audio-muted
      socket.emit('audio-muted', { isAudioMuted: isMuted })
    },
    emitVideoEnabled(isEnabled: boolean) {
      // TODO: TYPES video-toggled
      socket.emit('video-toggled', { isVideoEnabled: isEnabled })
    },
  }
}

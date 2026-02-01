import type { Socket } from 'socket.io-client'
import type { ProducerSocketApi } from '../types/types'
import { SOCKET_EVENTS, type AudioMutedData, type VideoToggledData } from '@mediasoup/types'

export function createProducerSocketApi(socket: Socket): ProducerSocketApi {
  return {
    emitAudioMuted(isMuted: boolean) {
      // TODO: TYPES audio-muted
      socket.emit(SOCKET_EVENTS.AUDIO_MUTED, { isAudioMuted: isMuted } satisfies AudioMutedData)
    },
    emitVideoEnabled(isEnabled: boolean) {
      // TODO: TYPES video-toggled
      socket.emit(SOCKET_EVENTS.VIDEO_TOGGLED, {
        isVideoEnabled: isEnabled,
      } satisfies VideoToggledData)
    },
  }
}

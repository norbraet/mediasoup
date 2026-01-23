import type { DeepReadonly, Ref } from 'vue'
import { types } from 'mediasoup-client'
import { useSocket } from './../composables/useSocket'

export type RoomParticipant = {
  userId: string
  userName: string
  audioTrack?: MediaStreamTrack
  videoTrack?: MediaStreamTrack
  audioConsumer?: Partial<types.Consumer<types.AppData>>
  videoConsumer?: Partial<types.Consumer<types.AppData>>
  videoElement?: HTMLVideoElement
  isActiveSpeaker?: boolean
}

export interface CurrentProducer {
  id: string
  kind: 'audio' | 'video'
  userId: string
}
export interface UseConferenceRoom {
  // Room State
  currentRoom: Readonly<Ref<string | null>>
  participants: Ref<Map<string, RoomParticipant>>
  isJoining: Readonly<Ref<boolean>>
  joinError: Readonly<Ref<string | null>>

  // WebRTC state
  device: DeepReadonly<Ref<types.Device | null>>
  isDeviceReady: Readonly<Ref<boolean>>
  routerCapabilities: DeepReadonly<Ref<types.RtpCapabilities | null>>
  currentProducers: DeepReadonly<Ref<CurrentProducer[]>>

  // Socket state
  isConnected: Readonly<Ref<boolean>>
  isConnecting: Readonly<Ref<boolean>>
  socket: ReturnType<typeof useSocket>

  // Media State
  localStream: DeepReadonly<Ref<MediaStream | null>>
  localVideoRef: Ref<HTMLVideoElement | undefined>
  isVideoEnabled: Readonly<Ref<boolean>>
  isAudioEnabled: Readonly<Ref<boolean>>
  isAudioMuted: Readonly<Ref<boolean>>
  isGettingMedia: Readonly<Ref<boolean>>
  mediaError: Readonly<Ref<string | null>>

  // Actions
  joinRoom(userName: string, roomName: string): Promise<void>
  leaveRoom(): void
  startVideo(): Promise<void>
  stopVideo(): void
  toggleVideo(): void
  toggleAudio(): void
}

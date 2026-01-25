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
  isVideoEnabled?: boolean
  isAudioMuted?: boolean
}

export type SpeakerData = {
  audioProducerId: string
  videoProducerId: string | null
  userName: string
  userId: string
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
  startAudio(): Promise<void>
  startVideo(): Promise<void>
  stopAudio(): void
  stopVideo(): void
  stopAll(): void
  toggleVideo(): void
  toggleAudio(): void
}

export interface ProducerSocketApi {
  emitAudioMuted(isMuted: boolean): void
  emitVideoEnabled(isEnabled: boolean): void
}

export interface ProducerSignalingApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestProducerTransport(): Promise<any>
  connectProducerTransport(dtlsParameters: types.DtlsParameters): Promise<void>
  startProducing(params: {
    kind: string
    rtpParameters: types.RtpParameters
    appData?: types.AppData
  }): Promise<{ id: string }>
}

export interface ConsumerSignalingApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestConsumerTransport(audioProducerId: string): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consumeMedia(params: { rtpCapabilities: any; producerId: string; kind: string }): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unpauseConsumer(producerId: string, kind: string): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectConsumerTransport(dtlsParameters: any, audioProducerId: string): Promise<any>
  updateActiveSpeakers(activeSpeakerIds: string[]): void
  participantVideoChanged(userId: string, isVideoEnabled: boolean): void
  participantAudioChanged(userId: string, isAudioMuted: boolean): void
  userJoined(userId: string, userName: string): void
  userLeft(userId: string, userName: string): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, listener?: (...args: any[]) => void): void
}

// Chat types
export type ChatMessage = {
  userId: string
  userName: string
  message: string
  timestamp: number
}

export type SendChatMessageData = {
  roomId: string
  message: string
  timestamp: number
}

export interface ChatSocketApi {
  sendChatMessage(data: SendChatMessageData): void
  onChatMessage(callback: (message: ChatMessage) => void): void
  offChatMessage(callback?: (message: ChatMessage) => void): void
}

export interface UseChat {
  messages: Ref<ChatMessage[]>
  sendMessage: (roomId: string, messageText: string) => void
  clearMessages: () => void
  getMessagesFromUser: (userId: string) => ChatMessage[]
  getRecentMessages: (count?: number) => ChatMessage[]
  setupChatListeners: () => void
  cleanupChatListeners: () => void
}

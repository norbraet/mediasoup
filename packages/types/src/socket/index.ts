import { RoleType } from '../mediasoup'

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  REQUEST_TRANSPORT: 'request-transport',
  CONNECT_TRANSPORT: 'connect-transport',
  START_PRODUCING: 'start-producing',
  CONSUME_MEDIA: 'consume-media',
  UNPAUSE_CONSUMER: 'unpause-consumer',
  AUDIO_MUTED: 'audio-muted',
  VIDEO_TOGGLED: 'video-toggled',
  CHAT_MESSAGE: 'chat-message',
} as const

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS]

export interface RecentSpeakerData {
  audioProducerId: string | null
  videoProducerId: string | null
  userName: string
  userId: string
}

export interface JoinRoomRequest {
  roomId: string
  userName: string
}

export interface JoinRoomResponseSuccess {
  success: true
  recentSpeakersData: RecentSpeakerData[]
  routerCapabilities: unknown
}

export interface JoinRoomResponseError {
  success: false
  error: string
}

export type JoinRoomResponse = JoinRoomResponseSuccess | JoinRoomResponseError

export interface RequestTransportSuccess {
  success: true
  params: unknown
}

export interface RequestTransportError {
  success: true | false
  error: string
}

export type RequestTransportResponse = RequestTransportSuccess | RequestTransportError

export interface ConnectTransportResponse {
  success: boolean
  error?: string
}

export interface StartProducingResponse {
  success: boolean
  id?: string
  error?: string
}

export interface StartConsumingResponse {
  success: boolean
  id?: string
  rtpParameters?: unknown
  error?: string
}

export interface ConsumeMediaResponse {
  success: boolean
  error?: string
  params?: unknown
}

export interface ResumeConsumerResponse {
  success: boolean
  error?: string
}

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

export interface RequestTransportData {
  type: RoleType
  audioProducerId?: string
}

// TODO: connect-transport - Missing correct server usage
export interface ConnectTransportData {
  dtlsParameters: unknown
  type: RoleType
  audioProducerId?: string
}

// TODO: start-producing - Missing correct server usage
export interface StartProducingData {
  kind: string
  rtpParameters: unknown
  appData?: Record<string, unknown>
}

// TODO: consume-media - Missing correct server usage
export interface ConsumeMediaData {
  producerId: string
  rtpCapabilities: unknown
  kind: string
}

export interface AudioMutedData {
  isAudioMuted: boolean
}

export interface VideoToggledData {
  isVideoEnabled: boolean
}

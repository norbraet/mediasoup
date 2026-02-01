export const Role = {
  Producer: 'producer',
  Consumer: 'consumer',
} as const

export type RoleType = 'producer' | 'consumer'

export interface RecentSpeakerData {
  audioProducerId: string | null
  videoProducerId: string | null
  userName: string
  userId: string
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
